import { dedupeVisits } from '../services/store';
import type { VisitRecord } from '../types';

function visit(
  partial: Partial<VisitRecord> &
    Pick<VisitRecord, 'id' | 'poiId' | 'title' | 'latitude' | 'longitude'>,
): VisitRecord {
  return {
    source: 'wikipedia',
    mode: 'walking',
    narratedAt: 1,
    ...partial,
  };
}

describe('visit dedupe', () => {
  it('merges same poiId', () => {
    const out = dedupeVisits([
      visit({
        id: 'a',
        poiId: 'wiki:1',
        title: 'Romford',
        latitude: 51.58,
        longitude: 0.18,
        narratedAt: 1,
      }),
      visit({
        id: 'b',
        poiId: 'wiki:1',
        title: 'Romford',
        latitude: 51.58,
        longitude: 0.18,
        narratedAt: 2,
        rating: 4,
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].rating).toBe(4);
    expect(out[0].narratedAt).toBe(2);
  });

  it('merges same title within ~200m even with different ids', () => {
    const out = dedupeVisits([
      visit({
        id: 'a',
        poiId: 'wiki:1',
        title: 'Romford Market',
        latitude: 51.576,
        longitude: 0.181,
        narratedAt: 1,
      }),
      visit({
        id: 'b',
        poiId: 'osm:node:9',
        title: 'Romford Market',
        latitude: 51.5761,
        longitude: 0.1812,
        narratedAt: 5,
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].poiId).toBe('osm:node:9');
  });

  it('keeps distinct places with the same name far apart', () => {
    const out = dedupeVisits([
      visit({
        id: 'a',
        poiId: 'wiki:1',
        title: 'Church',
        latitude: 51.5,
        longitude: -0.1,
        narratedAt: 1,
      }),
      visit({
        id: 'b',
        poiId: 'wiki:2',
        title: 'Church',
        latitude: 52.5,
        longitude: -1.5,
        narratedAt: 2,
      }),
    ]);
    expect(out).toHaveLength(2);
  });
});
