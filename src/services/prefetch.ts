import { haversineM, offsetAlongHeading } from '../geo';
import { config } from '../config';
import type { GeoPoint, Poi, PrefetchBatch } from '../types';
import { discoverPois, discoverPoisForPrefetch } from './poi/discover';
import { withTimeout } from './http';
import { getCachedPoisNear, getPrefetchBatch, savePois } from './store';

function dedupePois(pois: Poi[]): Poi[] {
  const byId = new Map<string, Poi>();
  for (const poi of pois) {
    const existing = byId.get(poi.id);
    if (!existing || (poi.distanceM ?? Infinity) < (existing.distanceM ?? Infinity)) {
      byId.set(poi.id, poi);
    }
  }
  return [...byId.values()];
}

/**
 * Walking Plan loops are for strolling near home — they must not become the
 * Drive narration stack when you later start a car trip.
 */
export function prefetchBatchUsableForDrive(
  batch: PrefetchBatch | null | undefined,
): boolean {
  if (!batch?.pois?.length) {
    return false;
  }
  if (batch.kind === 'loop' && batch.mode === 'walking') {
    return false;
  }
  return true;
}

/** Prefetch-batch POIs within radius, if that batch is meant for driving. */
export async function nearbyFromDrivePrefetch(
  point: GeoPoint,
  radiusM: number,
): Promise<Poi[]> {
  const batch = await getPrefetchBatch();
  if (!prefetchBatchUsableForDrive(batch)) {
    return [];
  }
  return batch!.pois
    .map(poi => {
      const location = {
        latitude: poi.latitude,
        longitude: poi.longitude,
      };
      return {
        id: poi.id,
        title: poi.title,
        summary: poi.summary,
        location,
        source: poi.source,
        category: poi.category,
        extractLength: poi.summary.length,
        isOutdoor: true,
        isIndoorVenue: false,
        distanceM: haversineM(point, location),
      } satisfies Poi;
    })
    .filter(poi => (poi.distanceM ?? Infinity) <= radiusM);
}

/**
 * Around / walking: prefer local cell cache when dense enough (offline-friendly).
 */
export async function cacheFirstDiscover(
  point: GeoPoint,
  radiusM: number = config.drivingPoiRadiusM,
): Promise<Poi[]> {
  let cached: Poi[] = [];
  try {
    cached = await getCachedPoisNear(point.latitude, point.longitude, radiusM);
  } catch (error) {
    console.warn('cache read failed', error);
  }
  if (cached.length >= 3) {
    return cached;
  }
  try {
    const live = await discoverPois(point, radiusM);
    if (live.length) {
      try {
        await savePois(live);
      } catch (error) {
        console.warn('cache write failed', error);
      }
      const liveIds = new Set(live.map(p => p.id));
      return [...live, ...cached.filter(c => !liveIds.has(c.id))];
    }
  } catch (error) {
    console.warn('discover failed', error);
  }
  return cached;
}

/**
 * Drive narration discovery: always try live GPS radius. Walking-loop Plan
 * cache must not block fresh places along the road.
 *
 * Dense cities: Wikipedia’s nearest-N around *you* are all <300 m, so we also
 * search from a point ahead on heading. Skip Overpass here — it stalls selecting.
 */
export async function discoverForNarration(
  point: GeoPoint,
  radiusM: number,
  mode: 'driving' | 'walking',
  opts?: { headingDeg?: number },
): Promise<Poi[]> {
  if (mode === 'walking') {
    return cacheFirstDiscover(point, radiusM);
  }

  const fromPlan = await nearbyFromDrivePrefetch(point, radiusM);
  const wikiRadius = Math.min(10_000, Math.max(radiusM, 3_000));
  const centers: GeoPoint[] = [point];
  if (opts?.headingDeg != null && Number.isFinite(opts.headingDeg)) {
    const leadM = Math.min(4_000, Math.max(1_200, Math.round(wikiRadius * 0.45)));
    centers.push(offsetAlongHeading(point, opts.headingDeg, leadM));
  }

  const batches = await Promise.all(
    centers.map(async center => {
      try {
        return await withTimeout(
          discoverPoisForPrefetch(center, wikiRadius),
          12_000,
          'drive-wiki',
        );
      } catch (error) {
        console.warn('drive wiki discover failed', error);
        return [] as Poi[];
      }
    }),
  );

  let live = dedupePois(
    batches.flat().map(p => ({
      ...p,
      distanceM: p.distanceM ?? haversineM(point, p.location),
    })),
  );

  if (live.length === 0) {
    try {
      live = await discoverPois(point, Math.min(radiusM, 5_000));
    } catch (error) {
      console.warn('discover fallback failed', error);
    }
  }

  if (live.length > 0) {
    try {
      await savePois(live);
    } catch (error) {
      console.warn('cache write failed', error);
    }
    return dedupePois([...live, ...fromPlan]);
  }

  if (fromPlan.length > 0) {
    return fromPlan;
  }

  try {
    return await getCachedPoisNear(point.latitude, point.longitude, radiusM);
  } catch {
    return [];
  }
}
