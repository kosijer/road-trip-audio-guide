import { config } from '../../config';
import { haversineM } from '../../geo';
import { fetchJsonSilent } from '../http';
import type { GeoPoint, Poi } from '../../types';
import { inferFlags } from './score';

type OverpassResponse = {
  elements?: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }>;
};

export async function searchOverpass(
  center: GeoPoint,
  radiusM: number,
): Promise<Poi[]> {
  const query = `[out:json][timeout:20];
(
  nwr["historic"](around:${Math.round(radiusM)},${center.latitude},${center.longitude});
  nwr["tourism"~"attraction|museum|viewpoint|artwork|archaeological_site"](around:${Math.round(radiusM)},${center.latitude},${center.longitude});
);
out center tags 35;`;
  const data = await fetchJsonSilent<OverpassResponse>(
    'https://overpass-api.de/api/interpreter',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    },
    20_000,
  );
  const elements = data?.elements ?? [];
  return elements
    .map(el => {
      const tags = el.tags ?? {};
      const title = tags.name || tags['name:en'] || tags.historic || tags.tourism;
      if (!title) {
        return null;
      }
      const location = {
        latitude: el.lat ?? el.center?.lat ?? center.latitude,
        longitude: el.lon ?? el.center?.lon ?? center.longitude,
      };
      const summary = [
        tags.historic && `historic=${tags.historic}`,
        tags.tourism && `tourism=${tags.tourism}`,
        tags.description,
        tags.wikipedia,
      ]
        .filter(Boolean)
        .join('. ');
      const flags = inferFlags(title, summary, tags);
      const poi: Poi = {
        id: `osm:${el.type}:${el.id}`,
        title,
        summary: summary || title,
        location,
        source: 'osm',
        category: tags.historic || tags.tourism,
        extractLength: (summary || title).length,
        distanceM: haversineM(center, location),
        wikidataId: tags.wikidata,
        ...flags,
      };
      return poi;
    })
    .filter((poi): poi is Poi => poi != null);
}
