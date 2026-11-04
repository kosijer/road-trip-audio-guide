import { t } from '../i18n';
import { config } from '../config';
import { fetchRouteSamples } from './directions';
import { withTimeout } from './http';
import { discoverPoisForPrefetch, rankPois } from './poi/discover';
import {
  getPrefetchPlaceTarget,
  savePois,
  savePrefetchBatch,
  setStatus,
} from './store';
import type { PrefetchBatch, Poi } from '../types';

/** Per corridor sample — must always settle so the UI cannot stick on busy. */
const SAMPLE_BUDGET_MS = 22_000;

/**
 * Map "places to keep" → corridor search points.
 * For small targets, use the same count so progress (n/n) matches the place goal.
 */
export function searchPointsForPlaceTarget(placeTarget: number): number {
  if (placeTarget <= 12) {
    return placeTarget;
  }
  return Math.min(16, Math.max(8, Math.round(placeTarget * 0.4)));
}

export function humanCategory(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed || /^Q\d+$/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export async function runPrefetch(
  origin: string,
  destination: string,
  onProgress?: (message: string) => void,
): Promise<{ count: number; batch: PrefetchBatch }> {
  const placeTarget = await getPrefetchPlaceTarget();
  const searchPoints = searchPointsForPlaceTarget(placeTarget);

  onProgress?.(t('prefetching'));
  let samples;
  try {
    samples = await withTimeout(
      fetchRouteSamples(origin.trim(), destination.trim(), searchPoints),
      30_000,
      'directions',
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'network_failed') {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('timeout:')) {
      throw new Error('network_failed');
    }
    throw error;
  }
  if (samples.length === 0) {
    throw new Error('route_failed');
  }

  const byId = new Map<string, Poi>();
  let failures = 0;

  for (let i = 0; i < samples.length; i++) {
    // Progress is UI-only via onProgress; persist only non-stuck final messages.
    onProgress?.(
      t('prefetchProgress', { current: i + 1, total: samples.length }),
    );
    try {
      const pois = await withTimeout(
        discoverPoisForPrefetch(samples[i], config.drivingPoiRadiusM),
        SAMPLE_BUDGET_MS,
        `prefetch-sample-${i + 1}`,
      );
      for (const poi of pois) {
        byId.set(poi.id, poi);
      }
    } catch (error) {
      failures += 1;
      console.warn('prefetch sample failed', i + 1, error);
    }
  }

  onProgress?.(t('prefetchRanking', { count: placeTarget }));
  const ranked = rankPois([...byId.values()]).slice(0, placeTarget);
  await savePois(ranked);

  const batch: PrefetchBatch = {
    origin: origin.trim(),
    destination: destination.trim(),
    originLatitude: samples[0]?.latitude,
    originLongitude: samples[0]?.longitude,
    placeTarget,
    sampleCount: samples.length,
    createdAt: Date.now(),
    kind: 'corridor',
    pois: ranked.map(poi => ({
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
  await setStatus({ prefetchCount: ranked.length });

  if (ranked.length === 0 && failures === samples.length) {
    throw new Error('prefetch_empty');
  }
  return { count: ranked.length, batch };
}
