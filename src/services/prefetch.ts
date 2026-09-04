import { config } from '../config';
import type { GeoPoint, Poi } from '../types';
import { getCachedPoisNear, savePois } from './store';
import { discoverPois } from './poi/discover';

export async function cacheFirstDiscover(
  point: GeoPoint,
  radiusM: number = config.drivingPoiRadiusM,
): Promise<Poi[]> {
  const cached = await getCachedPoisNear(point.latitude, point.longitude, radiusM);
  if (cached.length >= 3) {
    return cached;
  }
  try {
    const live = await discoverPois(point, radiusM);
    if (live.length) {
      await savePois(live);
      const liveIds = new Set(live.map(p => p.id));
      return [...live, ...cached.filter(c => !liveIds.has(c.id))];
    }
  } catch {
    // cache fallback
  }
  return cached;
}
