import { getPoi, recordVisit, savePoi } from '../services/store';
import type { Poi, PoiSource, VisitRecord } from '../types';
import { getOrClassifyPoi } from './classify';
import { buildExposureContext } from './context';
import {
  lastExposureForPoi,
  recordExposure,
  setExposureOutcome,
} from './preferenceStore';
import type { ExposureOutcome, PreferenceMode } from './types';

/** Optional stub when the POI cache miss (Around “more nearby”). */
export type TastePlaceStub = {
  id: string;
  title: string;
  summary?: string;
  category?: string;
  latitude: number;
  longitude: number;
  source?: PoiSource;
};

/**
 * Like / not-interested for a place that may not have an exposure yet
 * (e.g. Around “more nearby”, Plan accordion). Also upserts History.
 */
export async function applyTasteForPoi(
  poiId: string,
  outcome: 'liked' | 'not_interested',
  mode: PreferenceMode = 'browse',
  place?: TastePlaceStub,
): Promise<ExposureOutcome | null> {
  let poi = await getPoi(poiId);
  if (!poi && place) {
    poi = stubToPoi(place);
    await savePoi(poi);
  }
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
  const resolved =
    saved.outcome === 'ignored' ? null : saved.outcome;
  if (resolved) {
    const visitMode =
      mode === 'driving' || mode === 'walking' ? mode : 'walking';
    try {
      await recordVisit({
        poiId: poi.id,
        title: poi.title,
        category: poi.category,
        summary: poi.summary,
        source: poi.source,
        latitude: poi.location.latitude,
        longitude: poi.location.longitude,
        mode: visitMode,
        narrationExcerpt: poi.summary?.slice(0, 280),
      });
    } catch (error) {
      console.warn('recordVisit after taste failed', error);
    }
  }
  return resolved;
}

function stubToPoi(place: TastePlaceStub): Poi {
  return {
    id: place.id,
    title: place.title,
    summary: place.summary ?? '',
    location: {
      latitude: place.latitude,
      longitude: place.longitude,
    },
    source: place.source ?? 'wikipedia',
    category: place.category,
    extractLength: (place.summary ?? '').length,
    isOutdoor: true,
    isIndoorVenue: false,
  };
}

/** History rows may outlive the POI cache — rebuild a stub so taste still works. */
export async function applyTasteForVisit(
  visit: VisitRecord,
  outcome: 'liked' | 'not_interested',
): Promise<ExposureOutcome | null> {
  let poi = await getPoi(visit.poiId);
  if (!poi) {
    poi = {
      id: visit.poiId,
      title: visit.title,
      summary: visit.summary ?? '',
      location: {
        latitude: visit.latitude,
        longitude: visit.longitude,
      },
      source: visit.source,
      category: visit.category,
      extractLength: (visit.summary ?? '').length,
      isOutdoor: true,
      isIndoorVenue: false,
    };
    await savePoi(poi);
  }
  const mode: PreferenceMode =
    visit.mode === 'driving' || visit.mode === 'walking'
      ? visit.mode
      : 'browse';
  return applyTasteForPoi(visit.poiId, outcome, mode);
}
