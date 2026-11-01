import { haversineM } from '../geo';
import type { GeoPoint, LocationSample } from '../types';
import {
  SPEED_MIN_DISPLACEMENT_M,
  SPEED_MOVE_GATE_KMH,
} from './store';

/** Speed implied by how far we moved between two timed samples. */
export function speedFromDisplacementKmh(
  prev: LocationSample,
  next: LocationSample,
): number {
  const dtMs = next.timestamp - prev.timestamp;
  if (dtMs <= 0) {
    return 0;
  }
  const meters = haversineM(prev, next);
  return (meters / (dtMs / 1000)) * 3.6;
}

/**
 * GPS often reports null/0 speed (trains, network location). Prefer
 * displacement-derived speed when the device speed is missing or tiny.
 */
export function effectiveSpeedKmh(
  prev: LocationSample | undefined,
  next: LocationSample,
): number {
  if (!prev) {
    return next.speedKmh;
  }
  const derived = speedFromDisplacementKmh(prev, next);
  if (next.speedKmh < 1) {
    return derived;
  }
  return Math.max(next.speedKmh, derived);
}

/**
 * Sustained speed across recent samples, plus a displacement gate when the
 * threshold is low enough that GPS jitter can look like walking.
 */
export function evaluateMoving(input: {
  speedSamples: number[];
  locations: GeoPoint[];
  thresholdKmh: number;
  neededSamples: number;
  moveGateKmh?: number;
  minDisplacementM?: number;
}): boolean {
  const {
    speedSamples,
    locations,
    thresholdKmh,
    neededSamples,
    moveGateKmh = SPEED_MOVE_GATE_KMH,
    minDisplacementM = SPEED_MIN_DISPLACEMENT_M,
  } = input;

  if (speedSamples.length < neededSamples) {
    return false;
  }
  const recentSpeeds = speedSamples.slice(-neededSamples);
  if (!recentSpeeds.every(v => v >= thresholdKmh)) {
    return false;
  }
  if (thresholdKmh >= moveGateKmh) {
    return true;
  }
  if (locations.length < neededSamples) {
    return false;
  }
  const recentLocs = locations.slice(-neededSamples);
  const first = recentLocs[0];
  const last = recentLocs[recentLocs.length - 1];
  return haversineM(first, last) >= minDisplacementM;
}
