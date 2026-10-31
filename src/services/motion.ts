import { haversineM } from '../geo';
import type { GeoPoint } from '../types';
import {
  SPEED_MIN_DISPLACEMENT_M,
  SPEED_MOVE_GATE_KMH,
} from './store';

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
