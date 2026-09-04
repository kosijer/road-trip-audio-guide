import { DeviceEventEmitter } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import { config } from '../config';
import { s } from '../strings';
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
import { getCurrentLocation, requestLocationPermission } from './location';
import { generateNarration } from './narration';
import { rankPois } from './poi/discover';
import { cacheFirstDiscover } from './prefetch';
import { applyHoursPolicy, lookupOpeningHours } from './places';
import { speak, stopSpeaking } from './tts';
import { getWeather } from './weather';

export const STATUS_EVENT = 'rtag-status';

const speedSamples: number[] = [];
let tickTimer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

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
    return patch({ tripActive: false, message: s.permissionNeeded });
  }
  await resetTripMemory();
  speedSamples.length = 0;
  await patch({
    ...emptyStatus(),
    tripActive: true,
    llmCalls: 0,
    message: s.tripActive,
  });

  if (!BackgroundService.isRunning()) {
    await BackgroundService.start(keepAliveTask, {
      taskName: 'Trip',
      taskTitle: s.tripActive,
      taskDesc: s.appName,
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
    message: s.tripIdle,
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
      await patch({ message: s.locationFailed });
      return;
    }
    const moving = isMoving(location.speedKmh);
    const currentCell = cellId(location);
    await patch({
      lastLocation: location,
      moving,
      message: moving ? s.moving : s.stationary,
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
    return patch({ message: s.permissionNeeded });
  }
  await patch({ message: s.walkingBusy });
  let location: LocationSample;
  try {
    location = await getCurrentLocation();
  } catch (error) {
    console.warn('location failed', error);
    return patch({ message: s.locationFailed });
  }
  await patch({ lastLocation: location });
  await maybeNarrate(location, 'walking');
  return setStatus({});
}

async function maybeNarrate(
  location: LocationSample,
  mode: 'driving' | 'walking',
): Promise<void> {
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
      message: `${s.offlineSkip} (${String(error).slice(0, 80)})`,
    });
    return;
  }
  const narrated = new Set(await getNarratedIds());
  let candidates = rankPois(
    mode === 'walking' ? pois : pois.filter(poi => !narrated.has(poi.id)),
  );
  if (candidates.length === 0) {
    await patch({ message: s.noPoi });
    return;
  }

  const extras: string[] = [];
  if (mode === 'walking') {
    const weather = await getWeather(location.latitude, location.longitude);
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
      await patch({ message: s.noPoi });
      return;
    }
  }

  const selected = mode === 'driving' ? candidates.slice(0, 1) : candidates.slice(0, 3);
  const cacheKey = selected.map(p => p.id).join('|');
  const cached = await getNarration(cacheKey);
  let text = cached;
  if (!text) {
    const calls = await getLlmCalls();
    if (calls >= config.maxLlmCallsPerTrip) {
      await patch({ message: s.llmCap });
      return;
    }
    try {
      text = await generateNarration(selected, mode, extras);
      await incrementLlmCalls();
      await saveNarration(cacheKey, text);
    } catch (error) {
      console.warn('narration failed', error);
      await patch({ message: s.llmFailed });
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
    llmCalls,
    message: spoken ? selected[0]?.title ?? s.appName : s.ttsMissing,
  });
}

export async function headlessTripTask() {
  await keepAliveTask();
}
