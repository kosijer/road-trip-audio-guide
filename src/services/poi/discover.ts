import { haversineM } from '../../geo';
import { savePois } from '../store';
import type { GeoPoint, Poi } from '../../types';
import { searchOverpass } from './overpass';
import { interestingness } from './score';
import { enrichWithWikidata } from './wikidata';
import { searchWikipedia } from './wikipedia';

function dedupe(pois: Poi[]): Poi[] {
  const byTitle = new Map<string, Poi>();
  for (const poi of pois) {
    const key = poi.title.trim().toLowerCase();
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, poi);
      continue;
    }
    const samePlace = haversineM(existing.location, poi.location) < 80;
    if (samePlace) {
      const preferWiki =
        poi.source === 'wikipedia' && existing.source !== 'wikipedia';
      const longer = poi.extractLength > existing.extractLength;
      if (preferWiki || longer) {
        byTitle.set(key, {
          ...existing,
          ...poi,
          wikidataId: poi.wikidataId || existing.wikidataId,
          wikidataFacts: poi.wikidataFacts || existing.wikidataFacts,
        });
      }
    } else {
      byTitle.set(`${key}:${poi.id}`, poi);
    }
  }
  return [...byTitle.values()];
}

export function rankPois(pois: Poi[]): Poi[] {
  return [...pois].sort((a, b) => {
    const scoreDiff =
      interestingness(b.title, b.summary, b.extractLength) -
      interestingness(a.title, a.summary, a.extractLength);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return (a.distanceM ?? 0) - (b.distanceM ?? 0);
  });
}

export async function discoverPois(
  center: GeoPoint,
  radiusM: number,
): Promise<Poi[]> {
  const [wiki, osm] = await Promise.all([
    searchWikipedia(center, radiusM),
    searchOverpass(center, radiusM),
  ]);
  const wikiEnriched = await enrichWithWikidata(wiki);
  const merged = dedupe([...wikiEnriched, ...osm]);
  const ranked = rankPois(merged);
  await savePois(ranked);
  return ranked;
}
