import { DeviceEventEmitter } from 'react-native';
import { config } from '../config';
import { t, tn } from '../i18n';
import type { LocationSample, Poi, TripStatus } from '../types';
import {
  buildExposureContext,
  getOrClassifyPoi,
  getPreferenceProfile,
  getSessionState,
  lastExposureForPoi,
  rankCandidates,
  recordExposure,
  setExposureOutcome,
} from '../preferences';
import { applyHoursPolicy, lookupOpeningHours } from './places';
import { discoverForNarration } from './prefetch';
import { rankPois } from './poi/discover';
import {
  etaMinutes,
  headingFromSamples,
  lookaheadDistanceM,
  selectCorridorTier,
  type CorridorHit,
  type CorridorSide,
} from './headingCorridor';
import { getNarratedIds, setStatus } from './store';
import { speak, stopSpeaking, waitForSpeechIdle } from './tts';

/** Same channel as tripEngine.STATUS_EVENT (avoid circular import). */
const STATUS_EVENT = 'rtag-status';

export type DrivePhase =
  | 'idle'
  | 'selecting'
  | 'teaser'
  | 'hold'
  | 'full'
  | 'skipped'
  | 'cooldown';

export type UpcomingPoiView = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  etaMin?: number;
  distanceM?: number;
  side?: CorridorSide;
};

type Slot = {
  poi: Poi;
  corridor: CorridorHit;
  exposureId?: string;
  generation: number;
};

type NarrateFn = (poi: Poi) => Promise<void>;

let phase: DrivePhase = 'idle';
let slot: Slot | null = null;
let generation = 0;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let runTail: Promise<unknown> = Promise.resolve();
let suggestedThisTrip = new Set<string>();
let cooldownUntil = 0;
let narrateFull: NarrateFn | null = null;

/** Test hook — inject full-narration callback (and optionally clear). */
export function configureDriveQueue(opts: { narrateFull?: NarrateFn | null }) {
  if (opts.narrateFull !== undefined) {
    narrateFull = opts.narrateFull;
  }
}

export function getDrivePhase(): DrivePhase {
  return phase;
}

export function resetDriveQueue(): void {
  generation += 1;
  clearHoldTimer();
  phase = 'idle';
  slot = null;
  suggestedThisTrip = new Set();
  cooldownUntil = 0;
  void patchDriveStatus({
    drivePhase: 'idle',
    upcomingPoi: undefined,
    teaserText: undefined,
  });
}

function clearHoldTimer() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

function busyPhases(p: DrivePhase): boolean {
  return (
    p === 'selecting' ||
    p === 'teaser' ||
    p === 'hold' ||
    p === 'full'
  );
}

async function patchDriveStatus(
  partial: Partial<TripStatus>,
): Promise<TripStatus> {
  const status = await setStatus(partial);
  DeviceEventEmitter.emit(STATUS_EVENT, status);
  return status;
}

function upcomingFromSlot(s: Slot): UpcomingPoiView {
  return {
    id: s.poi.id,
    title: s.poi.title,
    latitude: s.poi.location.latitude,
    longitude: s.poi.location.longitude,
    distanceM: s.corridor.distanceM,
    etaMin: undefined,
    side: s.corridor.side,
  };
}

export function buildTeaserText(input: {
  title: string;
  etaMin: number;
  side: CorridorSide;
}): string {
  const sideKey =
    input.side === 'left'
      ? 'driveTeaserSideLeft'
      : input.side === 'right'
        ? 'driveTeaserSideRight'
        : 'driveTeaserSideAhead';
  return tn('driveTeaser', {
    eta: input.etaMin,
    side: tn(sideKey),
    title: input.title,
  });
}

async function rankDrivingCandidates(pois: Poi[]): Promise<Poi[]> {
  if (pois.length <= 1) {
    return pois;
  }
  const heuristic = rankPois(pois);
  const pool = heuristic.slice(0, 16);
  try {
    const [profile, session] = await Promise.all([
      getPreferenceProfile(),
      getSessionState(),
    ]);
    const prefCandidates = [];
    for (let index = 0; index < pool.length; index++) {
      const poi = pool[index];
      const classification = await getOrClassifyPoi(poi);
      const prior = await lastExposureForPoi(poi.id);
      prefCandidates.push({
        id: poi.id,
        title: poi.title,
        baseInterest: pool.length - index,
        categories: classification.categories,
        primaryCategory: classification.primaryCategory,
        lastExposedAt: prior?.suggestedAt,
      });
    }
    if (prefCandidates.length === 0) {
      return pool;
    }
    const result = rankCandidates(prefCandidates, profile, session, {
      limit: 1,
    });
    const byId = new Map(pool.map(p => [p.id, p]));
    const top = result.selected
      .map(c => byId.get(c.id))
      .filter((p): p is Poi => p != null);
    const rest = pool.filter(p => !top.some(t => t.id === p.id));
    return [...top, ...rest];
  } catch (error) {
    console.warn('drive rank failed', error);
    return pool;
  }
}

async function applyHours(candidates: Poi[]): Promise<Poi[]> {
  const withHours: Poi[] = [];
  for (const poi of candidates.slice(0, 10)) {
    const hours = await lookupOpeningHours(poi);
    let primary;
    try {
      primary = (await getOrClassifyPoi(poi)).primaryCategory;
    } catch {
      primary = undefined;
    }
    const next = applyHoursPolicy(
      { ...poi, hours: hours ?? poi.hours },
      { primaryCategory: primary },
    );
    if (next) {
      withHours.push(next);
    }
  }
  return withHours;
}

async function selectCandidate(
  sample: LocationSample,
  samples: LocationSample[],
): Promise<Slot | null> {
  const heading = headingFromSamples(samples);
  if (heading == null) {
    return null;
  }

  const narrowMax = Math.min(
    config.driveNarrowLookaheadM,
    lookaheadDistanceM(sample.speedKmh, config.driveNarrowLookaheadMin),
  );
  const wideMax = Math.min(
    config.driveWideLookaheadM,
    lookaheadDistanceM(sample.speedKmh, config.driveWideLookaheadMin),
  );
  const searchRadius = Math.max(wideMax, config.drivingPoiRadiusM);

  let pois: Poi[] = [];
  try {
    pois = await discoverForNarration(sample, searchRadius, 'driving');
  } catch (error) {
    console.warn('drive discover failed', error);
    return null;
  }

  const narrated = new Set(await getNarratedIds());
  pois = pois.filter(
    p => !narrated.has(p.id) && !suggestedThisTrip.has(p.id),
  );
  if (pois.length === 0) {
    return null;
  }

  const { hits } = selectCorridorTier(
    sample,
    heading,
    pois,
    {
      halfAngleDeg: config.driveNarrowHalfAngleDeg,
      maxDistanceM: narrowMax,
    },
    {
      halfAngleDeg: config.driveWideHalfAngleDeg,
      maxDistanceM: wideMax,
    },
  );
  if (hits.length === 0) {
    return null;
  }

  const withDistance: Poi[] = hits.map(h => ({
    ...h,
    distanceM: h.corridor.distanceM,
  }));
  const candidates = await applyHours(withDistance);
  if (candidates.length === 0) {
    return null;
  }

  const ranked = await rankDrivingCandidates(candidates);
  const pick = ranked[0];
  if (!pick) {
    return null;
  }
  const hit = hits.find(h => h.id === pick.id);
  if (!hit) {
    return null;
  }
  return {
    poi: pick,
    corridor: hit.corridor,
    generation,
  };
}

async function runSlot(gen: number, sample: LocationSample): Promise<void> {
  if (gen !== generation || !slot) {
    return;
  }

  const current = slot;
  const etaMin = etaMinutes(current.corridor.distanceM, sample.speedKmh);
  const teaserText = buildTeaserText({
    title: current.poi.title,
    etaMin,
    side: current.corridor.side,
  });

  phase = 'teaser';
  suggestedThisTrip.add(current.poi.id);

  let exposureId: string | undefined;
  try {
    const classification = await getOrClassifyPoi(current.poi);
    const exposure = await recordExposure({
      poiId: current.poi.id,
      categories: classification.categories,
      primaryCategory: classification.primaryCategory,
      context: buildExposureContext('driving'),
      viable: true,
    });
    exposureId = exposure.id;
    current.exposureId = exposureId;
  } catch (error) {
    console.warn('drive teaser exposure failed', error);
  }

  await patchDriveStatus({
    drivePhase: 'teaser',
    teaserText,
    lastExposureId: exposureId,
    upcomingPoi: {
      ...upcomingFromSlot(current),
      etaMin,
    },
    message: current.poi.title,
  });

  try {
    await speak(teaserText);
    await waitForSpeechIdle();
  } catch (error) {
    console.warn('drive teaser tts failed', error);
  }

  // Skip bumps `generation` so we abort here.
  if (gen !== generation) {
    return;
  }

  phase = 'hold';
  await patchDriveStatus({ drivePhase: 'hold' });

  await new Promise<void>(resolve => {
    holdTimer = setTimeout(() => {
      holdTimer = null;
      resolve();
    }, config.driveTeaserHoldMs);
  });

  if (gen !== generation) {
    return;
  }

  phase = 'full';
  await patchDriveStatus({
    drivePhase: 'full',
    teaserText: undefined,
  });

  try {
    if (narrateFull) {
      await narrateFull(current.poi);
    }
  } catch (error) {
    console.warn('drive full narration failed', error);
  }

  if (gen !== generation) {
    return;
  }

  phase = 'cooldown';
  cooldownUntil = Date.now() + config.driveSelectCooldownMs;
  slot = null;
  await patchDriveStatus({
    drivePhase: 'cooldown',
    upcomingPoi: undefined,
    teaserText: undefined,
  });
  phase = 'idle';
  await patchDriveStatus({ drivePhase: 'idle' });
}

export async function onDriveTick(
  sample: LocationSample,
  samples: LocationSample[],
): Promise<void> {
  if (busyPhases(phase)) {
    return;
  }
  if (Date.now() < cooldownUntil) {
    return;
  }

  phase = 'selecting';
  await patchDriveStatus({ drivePhase: 'selecting' });

  let next: Slot | null = null;
  try {
    next = await selectCandidate(sample, samples);
  } catch (error) {
    console.warn('drive select failed', error);
  }

  if (!next) {
    phase = 'idle';
    await patchDriveStatus({ drivePhase: 'idle' });
    return;
  }

  slot = next;
  const gen = generation;
  const run = () => runSlot(gen, sample);
  runTail = runTail.then(run, run);
  await runTail;
}

export async function skipDriveTeaser(): Promise<void> {
  if (phase !== 'teaser' && phase !== 'hold') {
    return;
  }
  const gen = generation;
  const current = slot;
  clearHoldTimer();
  phase = 'skipped';
  generation += 1;
  await stopSpeaking();

  if (current?.exposureId) {
    try {
      await setExposureOutcome(current.exposureId, 'skipped');
    } catch (error) {
      console.warn('drive skip outcome failed', error);
    }
  }

  cooldownUntil = Date.now() + config.driveSkipCooldownMs;
  slot = null;
  await patchDriveStatus({
    drivePhase: 'skipped',
    upcomingPoi: undefined,
    teaserText: undefined,
    message: t('driveTeaserSkipped'),
  });

  if (gen === generation - 1) {
    phase = 'idle';
    await patchDriveStatus({ drivePhase: 'idle' });
  }
}
