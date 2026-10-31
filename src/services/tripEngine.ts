import { DeviceEventEmitter } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import { config } from '../config';
import { t } from '../i18n';
import type { LocationSample, Poi, TripStatus } from '../types';
import { cellId } from '../geo';
import {
  emptyStatus,
  getLlmCalls,
  getNarratedIds,
  getNarration,
  getStatus,
  incrementLlmCalls,
  markNarrated,
  resetTripMemory,
  saveNarration,
  setStatus,
} from './store';
import {
  getCurrentLocation,
  getRealLocation,
  requestLocationPermission,
} from './location';
import { generateNarration } from './narration';
import { rankPois } from './poi/discover';
import { selectPoisForNarration } from './poi/rankWithDecision';
import { cacheFirstDiscover } from './prefetch';
import { applyHoursPolicy, lookupOpeningHours } from './places';
import { speak, stopSpeaking } from './tts';
import { getWeather } from './weather';

export const STATUS_EVENT = 'rtag-status';

const speedSamples: number[] = [];
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

function isMoving(speedKmh: number): boolean {
  speedSamples.push(speedKmh);
  while (speedSamples.length > config.sustainedSpeedSamples) {
    speedSamples.shift();
  }
  if (speedSamples.length < config.sustainedSpeedSamples) {
    return false;
  }
  return speedSamples.every(v => v >= config.drivingSpeedThresholdKmh);
}

async function keepAliveTask() {
  await new Promise<void>(resolve => {
    const handle = setInterval(() => {
      if (!BackgroundService.isRunning()) {
        clearInterval(handle);
        resolve();
      }
    }, 5000);
  });
}

export async function startTrip(): Promise<TripStatus> {
  const allowed = await requestLocationPermission();
  if (!allowed) {
    return patch({ tripActive: false, message: t('permissionNeeded') });
  }
  await resetTripMemory();
  speedSamples.length = 0;
  await patch({
    ...emptyStatus(),
    tripActive: true,
    llmCalls: 0,
    message: t('tripActive'),
  });

  if (!BackgroundService.isRunning()) {
    await BackgroundService.start(keepAliveTask, {
      taskName: 'Trip',
      taskTitle: t('tripActive'),
      taskDesc: t('appName'),
      taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      color: '#c47b3b',
      linkingURI: 'roadtripaudioguide://trip',
      foregroundServiceType: ['location'],
    });
  }

  if (!tickTimer) {
    tickTimer = setInterval(() => {
      void drivingTick();
    }, config.locationTickMs);
  }
  void drivingTick();
  return setStatus({});
}

export async function endTrip(): Promise<TripStatus> {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  try {
    if (BackgroundService.isRunning()) {
      await BackgroundService.stop();
    }
  } catch {
    // ignore
  }
  await stopSpeaking();
  return patch({
    tripActive: false,
    moving: false,
    message: t('tripIdle'),
  });
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
      location = await getCurrentLocation();
    } catch (error) {
      console.warn('location failed', error);
      await patch({ message: t('locationFailed') });
      return;
    }
    const moving = isMoving(location.speedKmh);
    const currentCell = cellId(location);
    await patch({
      lastLocation: location,
      moving,
      message: moving ? t('moving') : t('stationary'),
    });
    if (!moving) {
      return;
    }
    const intervalMs = config.drivingTriggerIntervalMin * 60_000;
    const dueByTime =
      !status.lastTriggerAt || Date.now() - status.lastTriggerAt >= intervalMs;
    const dueByCell = currentCell !== status.lastCellId;
    if (!dueByTime && !dueByCell) {
      return;
    }
    await maybeNarrate(location, 'driving');
    await patch({ lastTriggerAt: Date.now(), lastCellId: currentCell });
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
  await maybeNarrate(location, 'walking');
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
    pois = await cacheFirstDiscover(location, radius);
    if (mode === 'walking' && pois.length === 0) {
      pois = await cacheFirstDiscover(location, Math.max(radius, 3000));
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
    pois = await cacheFirstDiscover(location, Math.max(radius, 3000));
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
    const withHours: Poi[] = [];
    for (const poi of candidates.slice(0, 6)) {
      const hours = await lookupOpeningHours(poi);
      const next = applyHoursPolicy({
        ...poi,
        hours: hours ?? poi.hours,
        weatherCaveat:
          poi.isOutdoor && weather?.caveat ? weather.caveat : poi.weatherCaveat,
      });
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
  const spoken = await speak(text);
  const llmCalls = await getLlmCalls();
  await patch({
    lastNarration: text,
    lastPoiTitle: selected[0]?.title,
    lastPoiIds: selected.map(poi => poi.id),
    lastPoiMarkers: selected.map(poi => ({
      id: poi.id,
      title: poi.title,
      latitude: poi.location.latitude,
      longitude: poi.location.longitude,
    })),
    llmCalls,
    message: spoken ? selected[0]?.title ?? t('appName') : t('ttsMissing'),
  });
}

export async function headlessTripTask() {
  await keepAliveTask();
}
