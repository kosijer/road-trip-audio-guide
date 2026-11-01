import { getPoi } from '../services/store';
import { getOrClassifyPoi } from './classify';
import { buildExposureContext } from './context';
import {
  lastExposureForPoi,
  recordExposure,
  setExposureOutcome,
} from './preferenceStore';
import type { ExposureOutcome, PreferenceMode } from './types';

/**
 * Like / not-interested for a place that may not have an exposure yet
 * (e.g. Around “more nearby”, Plan accordion).
 */
export async function applyTasteForPoi(
  poiId: string,
  outcome: 'liked' | 'not_interested',
  mode: PreferenceMode = 'browse',
): Promise<ExposureOutcome | null> {
  const poi = await getPoi(poiId);
  if (!poi) {
    return null;
  }
  let exposure = await lastExposureForPoi(poiId);
  if (!exposure) {
    const classification = await getOrClassifyPoi(poi);
    exposure = await recordExposure({
      poiId,
      categories: classification.categories,
      primaryCategory: classification.primaryCategory,
      context: buildExposureContext(mode),
      viable: true,
    });
  }
  const saved = await setExposureOutcome(exposure.id, outcome);
  if (!saved) {
    return null;
  }
  return saved.outcome === 'ignored' ? null : saved.outcome;
}
