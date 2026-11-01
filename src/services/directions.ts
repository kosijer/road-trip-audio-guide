import { decodePolyline, sampleAlongRouteByCount } from '../geo';
import { config } from '../config';
import { fetchJson } from './http';
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
  let data: {
    status: string;
    routes?: Array<{ overview_polyline?: { points?: string } }>;
  };
  try {
    data = await fetchJson(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
    );
  } catch (error) {
    console.warn('directions network failed', error);
    throw new Error('network_failed');
  }
  if (data.status !== 'OK') {
    console.warn('directions status', data.status);
    return [];
  }
  const encoded = data.routes?.[0]?.overview_polyline?.points;
  if (!encoded) {
    return [];
  }
  return sampleAlongRouteByCount(decodePolyline(encoded), sampleTarget);
}
