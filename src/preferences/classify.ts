import type { Poi } from '../types';
import { classifyFromMapping, sanitizeCategories } from './categoryMapping';
import {
  getClassifications,
  saveClassification,
} from './preferenceStore';
import type { CategoryId, EraId, PoiClassification } from './types';

export async function getOrClassifyPoi(
  poi: Pick<Poi, 'id' | 'title' | 'summary' | 'category' | 'wikidataFacts'>,
): Promise<PoiClassification> {
  const cached = (await getClassifications())[poi.id];
  if (cached) {
    return cached;
  }
  const mapped = classifyFromMapping(poi);
  if (mapped) {
    await saveClassification(mapped);
    return mapped;
  }
  const fallback: PoiClassification = {
    poiId: poi.id,
    categories: ['other'],
    primaryCategory: 'other',
    era: 'unknown',
    source: 'mapping',
    classifiedAt: Date.now(),
  };
  await saveClassification(fallback);
  return fallback;
}

export async function classifyMany(
  pois: Array<Pick<Poi, 'id' | 'title' | 'summary' | 'category' | 'wikidataFacts'>>,
): Promise<Map<string, PoiClassification>> {
  const out = new Map<string, PoiClassification>();
  for (const poi of pois) {
    out.set(poi.id, await getOrClassifyPoi(poi));
  }
  return out;
}

export function repairLlmClassification(raw: {
  categories?: string[];
  primary_category?: string;
  era?: string;
}): { categories: CategoryId[]; primaryCategory: CategoryId; era: EraId } {
  const { categories, primaryCategory } = sanitizeCategories(
    raw.categories ?? [],
    raw.primary_category,
  );
  const era = (
    [
      'prehistoric',
      'antiquity',
      'medieval',
      'early_modern',
      '19th_century',
      '20th_century',
      'contemporary',
      'unknown',
    ] as EraId[]
  ).includes(raw.era as EraId)
    ? (raw.era as EraId)
    : 'unknown';
  return { categories, primaryCategory, era };
}
