import type { GeoPoint } from './types';

const DEFAULT_CELL_DEG = 0.045;

/** Reject NaN, out-of-range, and Null Island / emulator (0,0) defaults. */
export function isPlausibleLocation(point: GeoPoint): boolean {
  const { latitude, longitude } = point;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return false;
  }
  if (Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01) {
    return false;
  }
  return true;
}

export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Destination point after traveling `distanceM` along `headingDeg` (0=N). */
export function offsetAlongHeading(
  origin: GeoPoint,
  headingDeg: number,
  distanceM: number,
): GeoPoint {
  const R = 6_371_000;
  const δ = distanceM / R;
  const θ = (headingDeg * Math.PI) / 180;
  const φ1 = (origin.latitude * Math.PI) / 180;
  const λ1 = (origin.longitude * Math.PI) / 180;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * sinδ * cosφ1, cosδ - sinφ1 * sinφ2);
  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

export function cellId(point: GeoPoint, cellDeg = DEFAULT_CELL_DEG): string {
  return `${Math.round(point.latitude / cellDeg)}:${Math.round(
    point.longitude / cellDeg,
  )}`;
}

export function decodePolyline(encoded: string): GeoPoint[] {
  const points: GeoPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export function sampleAlongRoute(points: GeoPoint[], everyKm: number): GeoPoint[] {
  if (points.length === 0) {
    return [];
  }
  const samples: GeoPoint[] = [points[0]];
  let acc = 0;
  const everyM = everyKm * 1000;
  for (let i = 1; i < points.length; i++) {
    acc += haversineM(points[i - 1], points[i]);
    if (acc >= everyM) {
      samples.push(points[i]);
      acc = 0;
    }
  }
  const last = points[points.length - 1];
  const prev = samples[samples.length - 1];
  if (haversineM(prev, last) > 500) {
    samples.push(last);
  }
  return samples;
}

/** Evenly spaced samples along the polyline (includes start + end). */
export function sampleAlongRouteByCount(
  points: GeoPoint[],
  count: number,
): GeoPoint[] {
  if (points.length === 0 || count <= 0) {
    return [];
  }
  if (count === 1 || points.length === 1) {
    return [points[0]];
  }

  const segLens: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1], points[i]);
    segLens.push(total);
  }
  if (total <= 0) {
    return [points[0]];
  }

  const targets = Math.max(2, Math.round(count));
  const samples: GeoPoint[] = [];
  for (let s = 0; s < targets; s++) {
    const target = (total * s) / (targets - 1);
    let idx = 1;
    while (idx < segLens.length && segLens[idx] < target) {
      idx += 1;
    }
    if (idx >= points.length) {
      samples.push(points[points.length - 1]);
      continue;
    }
    const prevLen = segLens[idx - 1];
    const seg = segLens[idx] - prevLen;
    const t = seg > 0 ? (target - prevLen) / seg : 0;
    const a = points[idx - 1];
    const b = points[idx];
    samples.push({
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    });
  }
  return samples;
}
