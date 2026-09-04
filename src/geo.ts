import type { GeoPoint } from './types';

const DEFAULT_CELL_DEG = 0.045;

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
