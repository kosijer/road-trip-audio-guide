import { DeviceEventEmitter } from 'react-native';
import { config } from '../config';
import { t } from '../i18n';
import type { LocationSample, Poi, TripStatus } from '../types';
import { effectiveSpeedKmh, evaluateMoving } from './motion';
import {
  emptyStatus,
  getLlmCalls,
  getNarratedIds,
  getNarration,
  getSpeedThresholdKmh,
  getStatus,
  incrementLlmCalls,
  markNarrated,
  recordVisit,
  resetTripMemory,
  saveNarration,
  setStatus,
} from './store';
import {
  getCurrentLocation,
  getRealLocation,
  getTripLocation,
  requestLocationPermission,
} from './location';
import { generateNarration } from './narration';
import { rankPois } from './poi/discover';
import { selectPoisForNarration } from './poi/rankWithDecision';
import { discoverForNarration } from './prefetch';
import { applyHoursPolicy, lookupOpeningHours } from './places';
import {
  configureDriveQueue,
  onDriveTick,
  resetDriveQueue,
  skipDriveTeaser,
} from './driveQueue';
import { speak, stopSpeaking } from './tts';
import { getWeather } from './weather';

export const STATUS_EVENT = 'rtag-status';

configureDriveQueue({
  narrateFull: async (poi: Poi) => {
    await narrateFixedPoi(poi);
  },
});

type BackgroundActionsApi = {
  isRunning: () => boolean;
  start: (
    task: (args?: Record<string, unknown>) => Promise<void>,
    options: Record<string, unknown>,
  ) => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Resolve the background-actions singleton across Metro CJS/ESM interop.
 * Native start is best-effort — the in-app tick timer still drives narration.
 */
function getBackgroundActions(): BackgroundActionsApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-background-actions') as
      | BackgroundActionsApi
      | { default?: BackgroundActionsApi };
    const svc =
      mod && typeof (mod as BackgroundActionsApi).isRunning === 'function'
        ? (mod as BackgroundActionsApi)
        : (mod as { default?: BackgroundActionsApi }).default;
    if (
      svc &&
      typeof svc.isRunning === 'function' &&
      typeof svc.start === 'function' &&
      typeof svc.stop === 'function'
    ) {
      return svc;
    }
  } catch (error) {
    console.warn('background-actions unavailable', error);
  }
  return null;
}

const motionSamples: LocationSample[] = [];
let cachedSpeedThresholdKmh = config.drivingSpeedThresholdKmh;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let ticking = false;
let narrateTail: Promise<unknown> = Promise.resolve();

function emit(status: TripStatus) {
  DeviceEventEmitter.emit(STATUS_EVENT, status);
}

async function patch(partial: Partial<TripStatus>): Promise<TripStatus> {
  const status = await setStatus(partial);
  emit(status);
  return status;
}

/** Enrich sample with displacement-derived speed; return moving? + sample. */
function pushMotionSample(location: LocationSample): {
  moving: boolean;
  sample: LocationSample;
} {
  const prev = motionSamples[motionSamples.length - 1];
  const sample: LocationSample = {
    ...location,
    speedKmh: effectiveSpeedKmh(prev, location),
  };
  motionSamples.push(sample);
  while (motionSamples.length > config.sustainedSpeedSamples) {
    motionSamples.shift();
  }
  const moving = evaluateMoving({
    speedSamples: motionSamples.map(s => s.speedKmh),
    locations: motionSamples,
    thresholdKmh: cachedSpeedThresholdKmh,
    neededSamples: config.sustainedSpeedSamples,
  });
  return { moving, sample };
}

async function keepAliveTask() {
  const bg = getBackgroundActions();
  await new Promise<void>(resolve => {
    const handle = setInterval(() => {
      if (!bg || !bg.isRunning()) {
        clearInterval(handle);
        resolve();
      }
    }, 5000);
  });
}

async function startForegroundKeepAlive(): Promise<void> {
  const bg = getBackgroundActions();
  if (!bg || bg.isRunning()) {
    return;
  }
  await bg.start(keepAliveTask, {
    taskName: 'Trip',
    taskTitle: t('tripActive'),
    taskDesc: t('appName'),
    taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      color: '#ff7a59',
    linkingURI: 'roadtripaudioguide://trip',
    foregroundServiceType: ['location'],
  });
}

async function stopForegroundKeepAlive(): Promise<void> {
  const bg = getBackgroundActions();
  if (!bg || !bg.isRunning()) {
    return;
  }
  await bg.stop();
}

export async function startTrip(): Promise<TripStatus> {
  const allowed = await requestLocationPermission();
  if (!allowed) {
    return patch({ tripActive: false, message: t('permissionNeeded') });
  }
  await resetTripMemory();
  resetDriveQueue();
  motionSamples.length = 0;
  cachedSpeedThresholdKmh = await getSpeedThresholdKmh();
  await patch({
    ...emptyStatus(),
    tripActive: true,
    llmCalls: 0,
    drivePhase: 'idle',
    message: t('tripActive'),
  });

  try {
    await startForegroundKeepAlive();
  } catch (error) {
    console.warn('foreground keep-alive failed; trip continues in-app', error);
  }

  if (!tickTimer) {
    tickTimer = setInterval(() => {
      void drivingTick().catch(error =>
        console.warn('drivingTick failed', error),
      );
    }, config.locationTickMs);
  }
  void drivingTick().catch(error => console.warn('drivingTick failed', error));
  return getStatus();
}

export async function endTrip(): Promise<TripStatus> {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  try {
    await stopForegroundKeepAlive();
  } catch {
    // ignore
  }
  resetDriveQueue();
  await stopSpeaking();
  return patch({
    tripActive: false,
    moving: false,
    drivePhase: 'idle',
    upcomingPoi: undefined,
    teaserText: undefined,
    message: t('tripIdle'),
  });
}

export async function skipUpcomingTeaser(): Promise<TripStatus> {
  await skipDriveTeaser();
  return getStatus();
}

export async function drivingTick(): Promise<void> {
  if (ticking) {
    return;
  }
  ticking = true;
  try {
    const status = await getStatus();
    if (!status.tripActive) {
      return;
    }
    let location: LocationSample;
    try {
      location = await getTripLocation();
    } catch (error) {
      console.warn('location failed', error);
      await patch({ message: t('locationFailed') });
      return;
    }
    const { moving, sample } = pushMotionSample(location);
    // Motion state is shown on Drive UI — do not put it in `message`
    // (that feeds the global toast and flashes on Plan).
    await patch({
      lastLocation: sample,
      moving,
    });
    if (!moving) {
      return;
    }
    await onDriveTick(sample, [...motionSamples]);
    await patch({ lastTriggerAt: Date.now() });
  } finally {
    ticking = false;
  }
}

export async function walkingNow(): Promise<TripStatus> {
  const allowed = await requestLocationPermission();
  if (!allowed) {
    return patch({ message: t('permissionNeeded') });
  }
  await patch({ message: t('walkingBusy') });
  let location: LocationSample;
  try {
    location = await getCurrentLocation();
  } catch (error) {
    console.warn('location failed', error);
    return patch({ message: t('locationFailed') });
  }
  await patch({ lastLocation: location });
  // Same as Next: do not re-tell a place heard recently at this stop.
  await maybeNarrate(location, 'walking', { skipHeard: true });
  return setStatus({});
}

export async function narrateNext(): Promise<TripStatus> {
  await stopSpeaking();
  const allowed = await requestLocationPermission();
  if (!allowed) {
    return patch({ message: t('permissionNeeded') });
  }
  await patch({ message: t('nextBusy') });
  let location: LocationSample;
  try {
    location = (await getStatus()).lastLocation ?? (await getCurrentLocation());
  } catch (error) {
    console.warn('location failed', error);
    return patch({ message: t('locationFailed') });
  }
  await patch({ lastLocation: location });
  const mode = (await getStatus()).tripActive ? 'driving' : 'walking';
  await maybeNarrate(location, mode, { skipHeard: true });
  return setStatus({});
}

async function maybeNarrate(
  location: LocationSample,
  mode: 'driving' | 'walking',
  opts?: { skipHeard?: boolean },
): Promise<void> {
  const run = () => narrateOnce(location, mode, opts);
  const next = narrateTail.then(run, run);
  narrateTail = next;
  await next;
}

/** Full narration for a POI already chosen by the Drive v2 queue. */
async function narrateFixedPoi(poi: Poi): Promise<void> {
  const run = () =>
    deliverNarration([poi], 'driving', {
      extras: [],
      skipNewExposure: true,
    });
  const next = narrateTail.then(run, run);
  narrateTail = next;
  await next;
}

async function narrateOnce(
  location: LocationSample,
  mode: 'driving' | 'walking',
  opts?: { skipHeard?: boolean },
): Promise<void> {
  const skipHeard = mode === 'driving' || Boolean(opts?.skipHeard);
  const radius =
    mode === 'walking' ? config.walkingPoiRadiusM : config.drivingPoiRadiusM;
  let pois: Poi[] = [];
  try {
    pois = await discoverForNarration(location, radius, mode);
    if (mode === 'walking' && pois.length === 0) {
      pois = await discoverForNarration(
        location,
        Math.max(radius, 3000),
        mode,
      );
    }
  } catch (error) {
    console.warn('poi discovery failed', error);
    await patch({
      message: `${t('offlineSkip')} (${String(error).slice(0, 80)})`,
    });
    return;
  }
  const narrated = new Set(await getNarratedIds());
  const pickCandidates = (list: Poi[]) =>
    rankPois(skipHeard ? list.filter(poi => !narrated.has(poi.id)) : list);
  let candidates = pickCandidates(pois);
  if (mode === 'walking' && candidates.length === 0 && skipHeard) {
    pois = await discoverForNarration(
      location,
      Math.max(radius, 3000),
      mode,
    );
    candidates = pickCandidates(pois);
  }
  if (candidates.length === 0) {
    await patch({ message: skipHeard ? t('noMorePoi') : t('noPoi') });
    return;
  }

  const extras: string[] = [];
  if (mode === 'walking') {
    // Weather must reflect where the user actually is, even if POIs use a debug location.
    let weatherLat = location.latitude;
    let weatherLon = location.longitude;
    try {
      const real = await getRealLocation();
      weatherLat = real.latitude;
      weatherLon = real.longitude;
    } catch {
      // Keep POI coordinates if real GPS is unavailable.
    }
    const weather = await getWeather(weatherLat, weatherLon);
    if (weather?.caveat) {
      extras.push(weather.caveat);
    }
    candidates = candidates.map(poi => ({
      ...poi,
      weatherCaveat:
        poi.isOutdoor && weather?.caveat ? weather.caveat : poi.weatherCaveat,
    }));
  }

  // Hours for both walk & drive — skip closed indoor (museum at night).
  {
    const withHours: Poi[] = [];
    for (const poi of candidates.slice(0, 8)) {
      const hours = await lookupOpeningHours(poi);
      let primary;
      try {
        const { getOrClassifyPoi } = await import('../preferences');
        primary = (await getOrClassifyPoi(poi)).primaryCategory;
      } catch {
        primary = undefined;
      }
      const next = applyHoursPolicy(
        {
          ...poi,
          hours: hours ?? poi.hours,
        },
        { primaryCategory: primary },
      );
      if (next) {
        withHours.push(next);
      }
    }
    candidates = rankPois(withHours);
    if (candidates.length === 0) {
      await patch({ message: skipHeard ? t('noMorePoi') : t('noPoi') });
      return;
    }
  }

  // Heuristic shortlist first; Clef (when enabled) re-ranks before Gemini writes.
  const selected = await selectPoisForNarration(candidates, mode);
  await deliverNarration(selected, mode, { extras });
}

async function deliverNarration(
  selected: Poi[],
  mode: 'driving' | 'walking',
  opts: { extras: string[]; skipNewExposure?: boolean },
): Promise<void> {
  const extras = opts.extras;
  // v2: bust scripts that hallucinated weather before the rain-prompt fix.
  const cacheKey = `v2|${selected.map(p => p.id).join('|')}`;
  const cached = await getNarration(cacheKey);
  let text = cached;
  if (!text) {
    const calls = await getLlmCalls();
    if (calls >= config.maxLlmCallsPerTrip) {
      await patch({ message: t('llmCap') });
      return;
    }
    try {
      text = await generateNarration(selected, mode, extras);
      await incrementLlmCalls();
      await saveNarration(cacheKey, text);
    } catch (error) {
      console.warn('narration failed', error);
      await patch({ message: t('llmFailed') });
      return;
    }
  }
  for (const poi of selected) {
    await markNarrated(poi.id);
  }
  // One history entry per story — primary place only (avoids near-duplicate rows).
  const primary = selected[0];
  let lastExposureId: string | undefined = (await getStatus()).lastExposureId;
  if (primary) {
    await recordVisit({
      poiId: primary.id,
      title: primary.title,
      category: primary.category,
      summary: primary.summary,
      source: primary.source,
      latitude: primary.location.latitude,
      longitude: primary.location.longitude,
      mode,
      narrationExcerpt: text.slice(0, 280),
    });
    if (!opts.skipNewExposure) {
      try {
        const {
          buildExposureContext,
          getOrClassifyPoi,
          recordExposure,
        } = await import('../preferences');
        const classification = await getOrClassifyPoi(primary);
        const weatherOk = extras.length > 0 ? false : null;
        const exposure = await recordExposure({
          poiId: primary.id,
          categories: classification.categories,
          primaryCategory: classification.primaryCategory,
          context: buildExposureContext(mode, { weatherOk }),
          viable: true,
        });
        lastExposureId = exposure.id;
      } catch (error) {
        console.warn('exposure record failed', error);
      }
    }
  }
  const spoken = await speak(text);
  const llmCalls = await getLlmCalls();
  // Map shows only the focal place (Gemini may still weave nearby context into the script).
  const focus = selected[0];
  await patch({
    lastNarration: text,
    lastPoiTitle: focus?.title,
    lastPoiIds: selected.map(poi => poi.id),
    lastExposureId,
    lastPoiMarkers: focus
      ? [
          {
            id: focus.id,
            title: focus.title,
            latitude: focus.location.latitude,
            longitude: focus.location.longitude,
          },
        ]
      : [],
    llmCalls,
    upcomingPoi: undefined,
    teaserText: undefined,
    message: spoken ? focus?.title ?? t('appName') : t('ttsMissing'),
  });
}

export async function headlessTripTask() {
  await keepAliveTask();
}
