import { config } from '../../config';
import { haversineM } from '../../geo';
import { fetchJsonSilent } from '../http';
import type { GeoPoint, Poi } from '../../types';
import { inferFlags } from './score';

type GeoSearch = {
  query?: {
    geosearch?: Array<{
      pageid: number;
      title: string;
      lat: number;
      lon: number;
      dist?: number;
    }>;
  };
};

type ExtractQuery = {
  query?: {
    pages?: Record<
      string,
      {
        pageid: number;
        title: string;
        extract?: string;
        pageprops?: { wikibase_item?: string };
        coordinates?: Array<{ lat: number; lon: number }>;
      }
    >;
  };
};

export async function searchWikipedia(
  center: GeoPoint,
  radiusM: number,
): Promise<Poi[]> {
  const geo = await fetchJsonSilent<GeoSearch>(
    'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        list: 'geosearch',
        gscoord: `${center.latitude}|${center.longitude}`,
        gsradius: String(Math.min(10_000, Math.max(10, Math.round(radiusM)))),
        gslimit: '20',
        format: 'json',
        origin: '*',
      }).toString(),
  );
  const hits = geo?.query?.geosearch ?? [];
  if (hits.length === 0) {
    return [];
  }
  const ids = hits.map(h => h.pageid).join('|');
  const details = await fetchJsonSilent<ExtractQuery>(
    'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        pageids: ids,
        prop: 'extracts|pageprops|coordinates',
        explaintext: '1',
        exintro: '1',
        ppprop: 'wikibase_item',
        format: 'json',
        origin: '*',
      }).toString(),
  );
  const pages = Object.values(details?.query?.pages ?? {});
  return pages
    .map(page => {
      const match = hits.find(h => h.pageid === page.pageid);
      const location = {
        latitude: page.coordinates?.[0]?.lat ?? match?.lat ?? center.latitude,
        longitude: page.coordinates?.[0]?.lon ?? match?.lon ?? center.longitude,
      };
      const summary = (page.extract || '').trim();
      const flags = inferFlags(page.title, summary, undefined);
      return {
        id: `wiki:${page.pageid}`,
        title: page.title,
        summary,
        location,
        source: 'wikipedia' as const,
        wikidataId: page.pageprops?.wikibase_item,
        extractLength: summary.length,
        distanceM: haversineM(center, location),
        ...flags,
      };
    })
    .filter(poi => poi.title.length > 0)
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
}
