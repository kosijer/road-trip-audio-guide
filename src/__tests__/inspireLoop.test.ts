import {
  minStopSeparationM,
  orderNearestNeighbor,
  pickDiverseStops,
  searchRadiusM,
  stopCountForBudget,
  tourLengthKm,
  type RankedStop,
} from '../services/inspireLoop';

function stop(
  id: string,
  lat: number,
  lon: number,
  title = id,
): RankedStop {
  return {
    id,
    title,
    summary: title,
    latitude: lat,
    longitude: lon,
    source: 'wikipedia',
  };
}

describe('inspireLoop helpers', () => {
  it('maps budget to stop counts', () => {
    expect(stopCountForBudget(20)).toBe(2);
    expect(stopCountForBudget(60)).toBe(3);
    expect(stopCountForBudget(180)).toBe(4);
  });

  it('grows walking radius with budget but stays clamped', () => {
    const short = searchRadiusM('walking', 20);
    const long = searchRadiusM('walking', 180);
    expect(short).toBeGreaterThanOrEqual(800);
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThanOrEqual(8000);
  });

  it('drive radius is larger than walk for same budget', () => {
    expect(searchRadiusM('driving', 60)).toBeGreaterThan(
      searchRadiusM('walking', 60),
    );
  });

  it('tour length scales with mode speed', () => {
    expect(tourLengthKm('driving', 60)).toBeGreaterThan(
      tourLengthKm('walking', 60),
    );
  });

  it('orders stops nearest-neighbor from origin', () => {
    const origin = { latitude: 51.58, longitude: 0.18 };
    const ordered = orderNearestNeighbor(origin, [
      stop('far', 51.6, 0.25),
      stop('near', 51.581, 0.181),
      stop('mid', 51.59, 0.2),
    ]);
    expect(ordered.map(s => s.id)).toEqual(['near', 'mid', 'far']);
  });

  it('picks diverse stops when clustered alternatives exist', () => {
    const picks = pickDiverseStops(
      [
        stop('a', 51.58, 0.18),
        stop('a2', 51.5801, 0.1801),
        stop('b', 51.6, 0.22),
        stop('c', 51.56, 0.16),
      ],
      3,
      minStopSeparationM('walking', 90),
    );
    expect(picks).toHaveLength(3);
    expect(picks[0].id).toBe('a');
    expect(picks.map(p => p.id)).not.toContain('a2');
  });
});
