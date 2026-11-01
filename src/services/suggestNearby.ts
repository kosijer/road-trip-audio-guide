import { haversineM } from '../geo';
import { config } from '../config';
import {
  getOrClassifyPoi,
  getPreferenceProfile,
  getSessionState,
  isNightlifeViable,
  buildExposureContext,
  lastExposureForPoi,
  rankCandidates,
} from '../preferences';
import type { GeoPoint, Poi } from '../types';
import { cacheFirstDiscover } from './prefetch';
import { getNarratedIds } from './store';
import { rankPois } from './poi/discover';

export type NearbySuggestion = {
  id: string;
  title: string;
  summary: string;
  category?: string;
  latitude: number;
  longitude: number;
  distanceM: number;
};

/**
 * Ranked nearby list for Around “5 more” — no TTS.
 */
export async function suggestNearbyPlaces(
  here: GeoPoint,
  opts?: {
    limit?: number;
    excludeIds?: string[];
    radiusM?: number;
  },
): Promise<NearbySuggestion[]> {
  const limit = opts?.limit ?? 5;
  const radius = opts?.radiusM ?? Math.max(config.walkingPoiRadiusM, 1500);
  const exclude = new Set(opts?.excludeIds ?? []);
  for (const id of await getNarratedIds()) {
    exclude.add(id);
  }

  const discovered = await cacheFirstDiscover(here, radius);
  const filtered = discovered.filter(p => !exclude.has(p.id));
  if (filtered.length === 0) {
    return [];
  }

  const withDistance = filtered.map(poi => ({
    ...poi,
    distanceM: poi.distanceM ?? haversineM(here, poi.location),
  }));

  let ordered: Poi[] = rankPois(withDistance);
  try {
    const [profile, session] = await Promise.all([
      getPreferenceProfile(),
      getSessionState(),
    ]);
    const context = buildExposureContext('browse');
    const prefCandidates = [];
    const pool = ordered.slice(0, 20);
    for (let index = 0; index < pool.length; index++) {
      const poi = pool[index];
      const classification = await getOrClassifyPoi(poi);
      if (
        classification.primaryCategory === 'nightlife_social' &&
        !isNightlifeViable(context.daypart)
      ) {
        continue;
      }
      const prior = await lastExposureForPoi(poi.id);
      prefCandidates.push({
        id: poi.id,
        title: poi.title,
        baseInterest: pool.length - index,
        categories: classification.categories,
        primaryCategory: classification.primaryCategory,
        lastExposedAt: prior?.suggestedAt,
      });
    }
    if (prefCandidates.length > 0) {
      const result = rankCandidates(prefCandidates, profile, session, {
        limit: Math.min(limit, prefCandidates.length),
      });
      const byId = new Map(pool.map(p => [p.id, p]));
      ordered = result.selected
        .map(c => byId.get(c.id))
        .filter((p): p is Poi => p != null);
      for (const poi of pool) {
        if (!ordered.some(p => p.id === poi.id)) {
          ordered.push(poi);
        }
      }
    }
  } catch (error) {
    console.warn('suggestNearby rank failed', error);
  }

  return ordered.slice(0, limit).map(poi => ({
    id: poi.id,
    title: poi.title,
    summary: poi.summary,
    category: poi.category,
    latitude: poi.location.latitude,
    longitude: poi.location.longitude,
    distanceM: poi.distanceM ?? haversineM(here, poi.location),
  }));
}
