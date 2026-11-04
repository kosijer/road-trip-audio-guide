import { haversineM, toRad } from '../geo';
import type { GeoPoint, LocationSample } from '../types';

export type CorridorSide = 'left' | 'right' | 'ahead';

export type ConeParams = {
  halfAngleDeg: number;
  maxDistanceM: number;
};

export type CorridorHit = {
  distanceM: number;
  bearingToDeg: number;
  /** Signed relative bearing in (-180, 180]: negative = left. */
  relativeDeg: number;
  absRelativeDeg: number;
  side: CorridorSide;
  inCone: boolean;
};

/** Initial bearing from `from` to `to` in degrees [0, 360). */
export function bearingDeg(from: GeoPoint, to: GeoPoint): number {
  const φ1 = toRad(from.latitude);
  const φ2 = toRad(to.latitude);
  const Δλ = toRad(to.longitude - from.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/** Smallest signed difference b - a in (-180, 180]. */
export function relativeBearingDeg(headingDeg: number, targetBearingDeg: number): number {
  let d = targetBearingDeg - headingDeg;
  while (d > 180) {
    d -= 360;
  }
  while (d <= -180) {
    d += 360;
  }
  return d;
}

export function sideFromRelative(relativeDeg: number, aheadThresholdDeg = 15): CorridorSide {
  if (Math.abs(relativeDeg) <= aheadThresholdDeg) {
    return 'ahead';
  }
  return relativeDeg < 0 ? 'left' : 'right';
}

/**
 * Heading from recent GPS samples. Requires enough displacement so jitter
 * does not invent a bearing while nearly stationary.
 */
export function headingFromSamples(
  samples: LocationSample[],
  opts?: { minSpanM?: number; minSamples?: number },
): number | null {
  const minSamples = opts?.minSamples ?? 2;
  const minSpanM = opts?.minSpanM ?? 40;
  if (samples.length < minSamples) {
    return null;
  }
  const last = samples[samples.length - 1];
  // Prefer the earliest sample that is far enough back for a stable bearing.
  for (let i = samples.length - 2; i >= 0; i--) {
    const prev = samples[i];
    const span = haversineM(prev, last);
    if (span >= minSpanM) {
      return bearingDeg(prev, last);
    }
  }
  return null;
}

export function lookaheadDistanceM(speedKmh: number, lookaheadMin: number): number {
  const speed = Math.max(speedKmh, 15);
  return (speed / 3.6) * lookaheadMin * 60;
}

export function etaMinutes(distanceM: number, speedKmh: number): number {
  const speed = Math.max(speedKmh, 15);
  return Math.max(1, Math.round(distanceM / ((speed / 3.6) * 60)));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * How far ahead (in minutes) to search / prefer announcing, by speed.
 * Slow city: a few minutes is enough to decide. Highway: need ~15 min
 * to catch an exit / organize a detour.
 *
 * Anchors: ~40 km/h → 4 / 8 min; ~110 km/h (~70 mph) → 15 / 22 min.
 */
export function announceLeadMinutes(speedKmh: number): {
  narrowMin: number;
  wideMin: number;
} {
  const speed = Math.max(speedKmh, 20);
  const t = clamp((speed - 40) / (110 - 40), 0, 1);
  const narrowMin = 4 + t * (15 - 4);
  const wideMin = 8 + t * (22 - 8);
  return { narrowMin, wideMin };
}

/**
 * Soft floor: avoid teasing places that are already almost on top of you.
 * Includes room for teaser TTS + hold before the full story starts.
 */
export function minUsefulEtaMinutes(narrowLeadMin: number): number {
  return Math.max(2.5, narrowLeadMin * 0.55);
}

export function evaluateCorridor(
  origin: GeoPoint,
  headingDeg: number,
  target: GeoPoint,
  cone: ConeParams,
): CorridorHit {
  const distanceM = haversineM(origin, target);
  const bearingToDeg = bearingDeg(origin, target);
  const relativeDeg = relativeBearingDeg(headingDeg, bearingToDeg);
  const absRelativeDeg = Math.abs(relativeDeg);
  const side = sideFromRelative(relativeDeg);
  const inCone =
    distanceM <= cone.maxDistanceM && absRelativeDeg <= cone.halfAngleDeg;
  return {
    distanceM,
    bearingToDeg,
    relativeDeg,
    absRelativeDeg,
    side,
    inCone,
  };
}

export function filterInCone<T extends { location: GeoPoint }>(
  origin: GeoPoint,
  headingDeg: number,
  items: T[],
  cone: ConeParams,
): Array<T & { corridor: CorridorHit }> {
  const out: Array<T & { corridor: CorridorHit }> = [];
  for (const item of items) {
    const corridor = evaluateCorridor(origin, headingDeg, item.location, cone);
    if (corridor.inCone) {
      out.push({ ...item, corridor });
    }
  }
  return out;
}

/**
 * Prefer narrow cone; if empty, fall back to wide.
 * Returns which tier produced hits.
 */
export function selectCorridorTier<T extends { location: GeoPoint }>(
  origin: GeoPoint,
  headingDeg: number,
  items: T[],
  narrow: ConeParams,
  wide: ConeParams,
): { tier: 'narrow' | 'wide' | 'none'; hits: Array<T & { corridor: CorridorHit }> } {
  const narrowHits = filterInCone(origin, headingDeg, items, narrow);
  if (narrowHits.length > 0) {
    return { tier: 'narrow', hits: narrowHits };
  }
  const wideHits = filterInCone(origin, headingDeg, items, wide);
  if (wideHits.length > 0) {
    return { tier: 'wide', hits: wideHits };
  }
  return { tier: 'none', hits: [] };
}
