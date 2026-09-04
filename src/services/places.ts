import { config } from '../config';
import { fetchJsonSilent } from './http';
import type { Poi } from '../types';

type PlaceHours = {
  openNow?: boolean;
  weekdayText?: string[];
};

export async function lookupOpeningHours(poi: Poi): Promise<PlaceHours | null> {
  if (!config.googleMapsApiKey || !poi.title) {
    return null;
  }
  const data = await fetchJsonSilent<{
    places?: Array<{
      currentOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
      };
    }>;
  }>('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': config.googleMapsApiKey,
      'X-Goog-FieldMask': 'places.currentOpeningHours',
    },
    body: JSON.stringify({
      textQuery: `${poi.title}`,
      maxResultCount: 1,
      locationBias: {
        circle: {
          center: {
            latitude: poi.location.latitude,
            longitude: poi.location.longitude,
          },
          radius: 400,
        },
      },
    }),
  });
  const hours = data?.places?.[0]?.currentOpeningHours;
  if (!hours) {
    return null;
  }
  return {
    openNow: hours.openNow,
    weekdayText: hours.weekdayDescriptions,
  };
}

export function applyHoursPolicy(poi: Poi): Poi | null {
  if (poi.hours?.openNow !== false) {
    return poi;
  }
  if (poi.isIndoorVenue) {
    return null;
  }
  return {
    ...poi,
    hoursCaveat: 'Trenutno je zatvoreno, ali se može videti sa spolja.',
  };
}
