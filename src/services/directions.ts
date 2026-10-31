import { decodePolyline, sampleAlongRouteByCount } from '../geo';
import { config } from '../config';
import { fetchJsonSilent } from './http';
import type { GeoPoint } from '../types';

export async function fetchRouteSamples(
  origin: string,
  destination: string,
  sampleTarget: number,
): Promise<GeoPoint[]> {
  if (!config.googleMapsApiKey) {
    return [];
  }
  const params = new URLSearchParams({
    origin,
    destination,
    key: config.googleMapsApiKey,
  });
  const data = await fetchJsonSilent<{
    status: string;
    routes?: Array<{ overview_polyline?: { points?: string } }>;
  }>(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
  const encoded = data?.routes?.[0]?.overview_polyline?.points;
  if (!encoded) {
    return [];
  }
  return sampleAlongRouteByCount(decodePolyline(encoded), sampleTarget);
}
