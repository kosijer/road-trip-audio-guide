import type { Poi } from '../types';
import { CATEGORY_IDS } from './preferences.config';
import type { CategoryId, EraId, PoiClassification } from './types';

const WIKIDATA_P31: Record<string, CategoryId> = {
  Q839954: 'ancient_history', // archaeological site
  Q570116: 'nature_viewpoints', // tourist attraction often nature - weak
  Q23413: 'medieval_castles', // castle
  Q57821: 'medieval_castles', // fortification
  Q16748868: 'ww2_military',
  Q16970: 'religious_sites', // church
  Q44613: 'religious_sites', // monastery
  Q32815: 'religious_sites', // mosque
  Q22698: 'nature_viewpoints', // park
  Q23397: 'nature_viewpoints', // lake
  Q40050: 'beaches_coast', // beach
  Q33506: 'museums_galleries', // museum
  Q207694: 'museums_galleries', // art museum
  Q41176: 'architecture', // building
  Q12280: 'architecture', // bridge
  Q24354: 'nightlife_social', // theatre - weak nightlife
};

function fromOsmTags(tags: Record<string, string> | undefined): CategoryId[] {
  if (!tags) {
    return [];
  }
  const out: CategoryId[] = [];
  const historic = tags.historic;
  const tourism = tags.tourism;
  const amenity = tags.amenity;
  const natural = tags.natural;
  if (historic === 'castle' || historic === 'fort' || historic === 'ruins') {
    out.push(historic === 'ruins' ? 'ancient_history' : 'medieval_castles');
  }
  if (historic === 'battlefield' || historic === 'memorial') {
    out.push('ww2_military');
  }
  if (historic === 'archaeological_site') {
    out.push('ancient_history');
  }
  if (amenity === 'place_of_worship' || tags.religion) {
    out.push('religious_sites');
  }
  if (
    tourism === 'viewpoint' ||
    natural === 'peak' ||
    natural === 'cliff' ||
    natural === 'beach'
  ) {
    out.push(natural === 'beach' ? 'beaches_coast' : 'nature_viewpoints');
  }
  if (tourism === 'museum' || tourism === 'gallery') {
    out.push('museums_galleries');
  }
  if (tourism === 'attraction' && historic) {
    // already handled
  }
  if (amenity === 'marketplace' || amenity === 'restaurant' || amenity === 'cafe') {
    out.push('local_culture_food');
  }
  if (amenity === 'bar' || amenity === 'nightclub' || amenity === 'pub') {
    out.push('nightlife_social');
  }
  return [...new Set(out)];
}

function fromFreeText(title: string, summary: string, category?: string): CategoryId[] {
  const blob = `${title} ${summary} ${category ?? ''}`.toLowerCase();
  const hits: CategoryId[] = [];
  const rules: Array<[RegExp, CategoryId]> = [
    [/\b(castle|fortress|citadel|medieval)\b/, 'medieval_castles'],
    [/\b(roman|ruins|archaeolog|antiquit|amphitheatre)\b/, 'ancient_history'],
    [/\b(ww2|world war|battlefield|bunker|military)\b/, 'ww2_military'],
    [/\b(church|cathedral|mosque|monastery|temple|abbey)\b/, 'religious_sites'],
    [/\b(viewpoint|gorge|lake|park|hiking|nature|waterfall)\b/, 'nature_viewpoints'],
    [/\b(beach|cove|harbour|harbor|coast)\b/, 'beaches_coast'],
    [/\b(museum|gallery)\b/, 'museums_galleries'],
    [/\b(birthplace|memorial to|house of)\b/, 'famous_people'],
    [/\b(bridge|skyscraper|tower)\b/, 'architecture'],
    [/\b(market|village|cuisine|craft)\b/, 'local_culture_food'],
    [/\b(industrial|railway|factory|modern)\b/, 'modern_landmarks'],
    [/\b(pub|bar|nightlife|club|biergarten)\b/, 'nightlife_social'],
  ];
  for (const [re, id] of rules) {
    if (re.test(blob)) {
      hits.push(id);
    }
  }
  return [...new Set(hits)];
}

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

export function sanitizeCategories(
  categories: string[],
  primary?: string,
): { categories: CategoryId[]; primaryCategory: CategoryId } {
  const cleaned = categories
    .filter(isCategoryId)
    .filter(c => c !== 'other' || categories.length === 1)
    .slice(0, 3) as CategoryId[];
  const list = cleaned.length > 0 ? cleaned : (['other'] as CategoryId[]);
  let primaryCategory: CategoryId =
    primary && isCategoryId(primary) ? primary : list[0];
  if (!list.includes(primaryCategory)) {
    primaryCategory = list[0];
  }
  return { categories: list, primaryCategory };
}

/** Deterministic classification from OSM/Wiki text — no LLM. */
export function classifyFromMapping(
  poi: Pick<Poi, 'id' | 'title' | 'summary' | 'category' | 'wikidataFacts'>,
  osmTags?: Record<string, string>,
): PoiClassification | null {
  const fromWiki: CategoryId[] = [];
  const p31 = poi.wikidataFacts?.P31 || poi.wikidataFacts?.instanceOf;
  if (p31) {
    for (const part of p31.split(/[,;]/)) {
      const qid = part.trim().match(/Q\d+/)?.[0];
      if (qid && WIKIDATA_P31[qid]) {
        fromWiki.push(WIKIDATA_P31[qid]);
      }
    }
  }
  const merged = [
    ...fromWiki,
    ...fromOsmTags(osmTags),
    ...fromFreeText(poi.title, poi.summary, poi.category),
  ];
  const unique = [...new Set(merged)].slice(0, 3);
  if (unique.length === 0) {
    return null;
  }
  const { categories, primaryCategory } = sanitizeCategories(unique);
  return {
    poiId: poi.id,
    categories,
    primaryCategory,
    era: 'unknown' as EraId,
    source: 'mapping',
    classifiedAt: Date.now(),
  };
}
