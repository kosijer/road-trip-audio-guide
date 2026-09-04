import { fetchJsonSilent } from '../http';
import type { Poi } from '../../types';

type WikidataEntity = {
  entities?: Record<
    string,
    {
      claims?: Record<
        string,
        Array<{
          mainsnak?: {
            datavalue?: {
              value?:
                | string
                | { time?: string; id?: string; text?: string };
            };
          };
        }>
      >;
    }
  >;
};

const FACT_PROPS: Record<string, string> = {
  P31: 'instanceOf',
  P571: 'inception',
  P17: 'country',
  P131: 'adminArea',
  P19: 'birthPlace',
  P585: 'pointInTime',
};

export async function enrichWithWikidata(pois: Poi[]): Promise<Poi[]> {
  const ids = pois.map(p => p.wikidataId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return pois;
  }
  const unique = [...new Set(ids)].slice(0, 20);
  const data = await fetchJsonSilent<WikidataEntity>(
    'https://www.wikidata.org/w/api.php?' +
      new URLSearchParams({
        action: 'wbgetentities',
        ids: unique.join('|'),
        props: 'claims',
        format: 'json',
        origin: '*',
      }).toString(),
  );
  if (!data?.entities) {
    return pois;
  }
  return pois.map(poi => {
    if (!poi.wikidataId || !data.entities?.[poi.wikidataId]) {
      return poi;
    }
    const claims = data.entities[poi.wikidataId].claims ?? {};
    const facts: Record<string, string> = {};
    for (const [prop, label] of Object.entries(FACT_PROPS)) {
      const snak = claims[prop]?.[0]?.mainsnak?.datavalue?.value;
      if (!snak) {
        continue;
      }
      if (typeof snak === 'string') {
        facts[label] = snak;
      } else if (snak.time) {
        facts[label] = snak.time.slice(1, 11);
      } else if (snak.id) {
        facts[label] = snak.id;
      } else if (snak.text) {
        facts[label] = snak.text;
      }
    }
    return {
      ...poi,
      wikidataFacts: Object.keys(facts).length ? facts : poi.wikidataFacts,
      category: facts.instanceOf || poi.category,
    };
  });
}
