import { config } from '../config';
import type { GeoPoint } from '../types';
import { fetchJson } from './http';

export type GeocodedPlace = GeoPoint & { formattedAddress: string };

/**
 * Resolve a place name / address to coordinates.
 * Uses Places Text Search (same API as opening-hours lookup).
 */
export async function geocodeQuery(query: string): Promise<GeocodedPlace | null> {
  const address = query.trim();
  if (!config.googleMapsApiKey || !address) {
    return null;
  }
  let data: {
    places?: Array<{
      formattedAddress?: string;
      displayName?: { text?: string };
      location?: { latitude?: number; longitude?: number };
    }>;
  };
  try {
    data = await fetchJson(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.googleMapsApiKey,
          'X-Goog-FieldMask':
            'places.formattedAddress,places.displayName,places.location',
        },
        body: JSON.stringify({
          textQuery: address,
          maxResultCount: 1,
        }),
      },
    );
  } catch (error) {
    console.warn('geocode network failed', error);
    throw new Error('network_failed');
  }
  const place = data?.places?.[0];
  const lat = place?.location?.latitude;
  const lon = place?.location?.longitude;
  if (
    !place ||
    lat == null ||
    lon == null ||
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    console.warn('geocode no result', address);
    return null;
  }
  return {
    latitude: lat,
    longitude: lon,
    formattedAddress:
      place.formattedAddress || place.displayName?.text || address,
  };
}
