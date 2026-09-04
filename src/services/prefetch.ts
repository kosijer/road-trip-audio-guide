import { config } from '../config';
import type { GeoPoint, Poi } from '../types';
import { getCachedPoisNear, savePois } from './store';
import { discoverPois } from './poi/discover';

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
