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
import type { GeoPoint, Poi, PrefetchBatch } from '../types';
import { discoverPois, discoverPoisForPrefetch, rankPois } from './poi/discover';
import { filterPoisForVisitNow } from './places';
import { humanCategory } from './routePrefetch';
import { savePois, savePrefetchBatch, setStatus } from './store';

export type InspireMode = 'walking' | 'driving';

export const INSPIRE_BUDGET_MIN = 20;
export const INSPIRE_BUDGET_MAX = 300; // 5h
export const INSPIRE_BUDGET_STEP = 5;

/** Effective tour speed for budget → distance. */
export function inspireSpeedKmh(mode: InspireMode): number {
  return mode === 'walking' ? 4.5 : 35;
}

export function tourLengthKm(mode: InspireMode, budgetMin: number): number {
  const minutes = Math.min(
    INSPIRE_BUDGET_MAX,
    Math.max(INSPIRE_BUDGET_MIN, budgetMin),
  );
  return inspireSpeedKmh(mode) * (minutes / 60);
}

/** Search radius so a loop of tourLength can fit nearby candidates. */
export function searchRadiusM(mode: InspireMode, budgetMin: number): number {
  const tourM = tourLengthKm(mode, budgetMin) * 1000;
  const raw = tourM * 0.35;
  if (mode === 'walking') {
    return Math.round(Math.min(8_000, Math.max(800, raw)));
  }
  return Math.round(Math.min(80_000, Math.max(3_000, raw)));
}

export function stopCountForBudget(budgetMin: number): number {
  const minutes = Math.min(
    INSPIRE_BUDGET_MAX,
    Math.max(INSPIRE_BUDGET_MIN, budgetMin),
  );
  if (minutes < 45) {
    return 2;
  }
  if (minutes < 120) {
    return 3;
  }
  return 4;
}

/** Min separation between stops (~8% of tour, clamped). */
export function minStopSeparationM(mode: InspireMode, budgetMin: number): number {
  const tourM = tourLengthKm(mode, budgetMin) * 1000;
  const raw = tourM * 0.08;
  if (mode === 'walking') {
    return Math.round(Math.min(1_500, Math.max(250, raw)));
  }
  return Math.round(Math.min(12_000, Math.max(800, raw)));
}

export type RankedStop = {
  id: string;
  title: string;
  summary: string;
  category?: string;
  latitude: number;
  longitude: number;
  source: Poi['source'];
  distanceM?: number;
};

/**
 * Greedy pick: take next highest-ranked POI that is far enough from picks.
 */
export function pickDiverseStops(
  ordered: RankedStop[],
  want: number,
  minSeparationM: number,
): RankedStop[] {
  const picked: RankedStop[] = [];
  for (const candidate of ordered) {
    if (picked.length >= want) {
      break;
    }
    const farEnough = picked.every(
      p =>
        haversineM(
          { latitude: p.latitude, longitude: p.longitude },
          { latitude: candidate.latitude, longitude: candidate.longitude },
        ) >= minSeparationM,
    );
    if (picked.length === 0 || farEnough) {
      picked.push(candidate);
    }
  }
  // If diversity starved us, fill with next best remaining.
  if (picked.length < want) {
    for (const candidate of ordered) {
      if (picked.length >= want) {
        break;
      }
      if (!picked.some(p => p.id === candidate.id)) {
        picked.push(candidate);
      }
    }
  }
  return picked;
}

/** Nearest-neighbor tour from origin through stops (does not append origin). */
export function orderNearestNeighbor(
  origin: GeoPoint,
  stops: RankedStop[],
): RankedStop[] {
  const remaining = [...stops];
  const ordered: RankedStop[] = [];
  let cursor = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineM(cursor, {
        latitude: remaining[i].latitude,
        longitude: remaining[i].longitude,
      });
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    cursor = { latitude: next.latitude, longitude: next.longitude };
  }
  return ordered;
}

function poiToStop(poi: Poi): RankedStop {
  return {
    id: poi.id,
    title: poi.title,
    summary: poi.summary,
    category: humanCategory(poi.category),
    latitude: poi.location.latitude,
    longitude: poi.location.longitude,
    source: poi.source,
    distanceM: poi.distanceM,
  };
}

async function rankForBrowse(pois: Poi[]): Promise<Poi[]> {
  if (pois.length <= 1) {
    return pois;
  }
  const heuristic = rankPois(pois);
  const pool = heuristic.slice(0, 24);
  try {
    const [profile, session] = await Promise.all([
      getPreferenceProfile(),
      getSessionState(),
    ]);
    const context = buildExposureContext('browse');
    const prefCandidates = [];
    for (let index = 0; index < pool.length; index++) {
      const poi = pool[index];
      const classification = await getOrClassifyPoi(poi);
      if (
        classification.primaryCategory === 'nightlife_social' &&
        !isNightlifeViable(context.daypart)
      ) {
        continue;
      }
      // Museums/galleries are poor stop picks late unless hours say open
      // (hours filter runs next — skip obvious late museums here).
      if (
        classification.primaryCategory === 'museums_galleries' &&
        (context.daypart === 'evening' || context.daypart === 'night') &&
        poi.hours?.openNow !== true
      ) {
        continue;
      }
      const prior = await lastExposureForPoi(poi.id);
      const late =
        context.daypart === 'evening' || context.daypart === 'night';
      // Nudge pubs / food up in the evening so loops aren’t only landmarks.
      let baseInterest = pool.length - index;
      if (
        late &&
        (classification.primaryCategory === 'nightlife_social' ||
          classification.primaryCategory === 'local_culture_food')
      ) {
        baseInterest += 8;
      }
      prefCandidates.push({
        id: poi.id,
        title: poi.title,
        baseInterest,
        categories: classification.categories,
        primaryCategory: classification.primaryCategory,
        lastExposedAt: prior?.suggestedAt,
      });
    }
    if (prefCandidates.length === 0) {
      return pool;
    }
    // Pull a wide selected set so pickDiverseStops still has material.
    const want = Math.min(12, prefCandidates.length);
    const result = rankCandidates(prefCandidates, profile, session, {
      limit: want,
    });
    const byId = new Map(pool.map(p => [p.id, p]));
    const ordered = result.selected
      .map(c => byId.get(c.id))
      .filter((p): p is Poi => p != null);
    for (const poi of pool) {
      if (!ordered.some(p => p.id === poi.id)) {
        ordered.push(poi);
      }
    }
    return ordered;
  } catch (error) {
    console.warn('inspire rank failed', error);
    return pool;
  }
}

export async function runInspireLoop(input: {
  originLabel: string;
  origin: GeoPoint;
  mode: InspireMode;
  budgetMin: number;
  onProgress?: (message: string) => void;
}): Promise<{
  stopCount: number;
  cacheCount: number;
  batch: PrefetchBatch;
  stops: RankedStop[];
}> {
  const budgetMin = Math.min(
    INSPIRE_BUDGET_MAX,
    Math.max(INSPIRE_BUDGET_MIN, Math.round(input.budgetMin)),
  );
  const radius = searchRadiusM(input.mode, budgetMin);
  const wantStops = stopCountForBudget(budgetMin);
  const minSep = minStopSeparationM(input.mode, budgetMin);

  input.onProgress?.('inspire_discover');
  const discovered = await discoverPois(input.origin, radius);
  if (discovered.length === 0) {
    throw new Error('inspire_empty');
  }

  const withDistance = discovered.map(poi => ({
    ...poi,
    distanceM:
      poi.distanceM ??
      haversineM(input.origin, poi.location),
  }));

  input.onProgress?.('inspire_ranking');
  const rankedPois = await rankForBrowse(withDistance);
  // Drop indoor venues that are closed / likely closed (e.g. museum at 20:00).
  // Outdoor landmarks that are “closed” may stay with a facade caveat.
  const visitNow = await filterPoisForVisitNow(rankedPois, {
    primaryCategoryOf: async poi => {
      const c = await getOrClassifyPoi(poi);
      return c.primaryCategory;
    },
    lookupCap: Math.max(10, wantStops * 4),
  });
  const stopPool = visitNow.length > 0 ? visitNow : rankedPois;
  const stopCandidates = stopPool.map(poiToStop);
  const diverse = pickDiverseStops(stopCandidates, wantStops, minSep);
  if (diverse.length === 0) {
    throw new Error('inspire_empty');
  }
  const stops = orderNearestNeighbor(input.origin, diverse);

  // Prefetch cache around each stop (reuse corridor place target sizing).
  input.onProgress?.('inspire_prefetch');
  const byId = new Map<string, Poi>();
  for (const stop of stops) {
    byId.set(
      stop.id,
      withDistance.find(p => p.id === stop.id) ?? {
        id: stop.id,
        title: stop.title,
        summary: stop.summary,
        location: {
          latitude: stop.latitude,
          longitude: stop.longitude,
        },
        source: stop.source,
        extractLength: stop.summary.length,
        isOutdoor: true,
        isIndoorVenue: false,
        category: stop.category,
        distanceM: stop.distanceM,
      },
    );
    try {
      const near = await discoverPoisForPrefetch(
        { latitude: stop.latitude, longitude: stop.longitude },
        input.mode === 'walking'
          ? config.walkingPoiRadiusM
          : config.drivingPoiRadiusM,
      );
      for (const poi of near) {
        byId.set(poi.id, poi);
      }
    } catch (error) {
      console.warn('inspire stop prefetch failed', stop.title, error);
    }
  }

  const cached = rankPois([...byId.values()]);
  await savePois(cached);

  const hours = budgetMin >= 60 ? `${(budgetMin / 60).toFixed(1)}h` : `${budgetMin}m`;
  const batch: PrefetchBatch = {
    origin: input.originLabel,
    destination: `Loop · ${input.mode} · ${hours}`,
    originLatitude: input.origin.latitude,
    originLongitude: input.origin.longitude,
    placeTarget: cached.length,
    sampleCount: stops.length,
    createdAt: Date.now(),
    kind: 'loop',
    budgetMin,
    mode: input.mode,
    stops: stops.map(s => ({
      id: s.id,
      title: s.title,
      latitude: s.latitude,
      longitude: s.longitude,
      summary: s.summary,
      category: s.category,
    })),
    pois: cached.slice(0, Math.max(12, stops.length * 4)).map(poi => ({
      id: poi.id,
      title: poi.title,
      summary: poi.summary,
      category: humanCategory(poi.category),
      latitude: poi.location.latitude,
      longitude: poi.location.longitude,
      source: poi.source,
    })),
  };

  await savePrefetchBatch(batch);
  await setStatus({ prefetchCount: batch.pois.length });
  // `stops` = itinerary length shown to the user; pois[] extras are Drive cache.
  return {
    stopCount: stops.length,
    cacheCount: batch.pois.length,
    batch,
    stops,
  };
}
