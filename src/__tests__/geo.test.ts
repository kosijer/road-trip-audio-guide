import {
  haversineM,
  isPlausibleLocation,
  sampleAlongRoute,
  sampleAlongRouteByCount,
} from '../geo';
import {
  humanCategory,
  searchPointsForPlaceTarget,
} from '../services/routePrefetch';
import { interestingness, scoreKeywords } from '../services/poi/score';

describe('geo', () => {
  it('rejects Null Island and non-finite coordinates', () => {
    expect(isPlausibleLocation({ latitude: 0, longitude: 0 })).toBe(false);
    expect(isPlausibleLocation({ latitude: 0.001, longitude: -0.001 })).toBe(
      false,
    );
    expect(isPlausibleLocation({ latitude: NaN, longitude: -0.1 })).toBe(false);
    expect(isPlausibleLocation({ latitude: 51.5, longitude: -0.12 })).toBe(
      true,
    );
  });

  it('computes haversine distance for nearby points', () => {
    const knossos = { latitude: 35.2978, longitude: 25.1631 };
    const heraklion = { latitude: 35.3387, longitude: 25.1442 };
    const meters = haversineM(knossos, heraklion);
    expect(meters).toBeGreaterThan(4000);
    expect(meters).toBeLessThan(8000);
  });

  it('samples constructed points about every 8 km', () => {
    const points = [];
    for (let i = 0; i < 20; i++) {
      points.push({ latitude: 35.3, longitude: 23.7 + i * 0.08 });
    }
    const samples = sampleAlongRoute(points, 8);
    expect(samples.length).toBeGreaterThan(2);
    expect(samples.length).toBeLessThan(points.length);
  });

  it('samples a fixed count evenly along the route', () => {
    const points = [];
    for (let i = 0; i < 50; i++) {
      points.push({ latitude: 51.5, longitude: -0.1 + i * 0.02 });
    }
    const samples = sampleAlongRouteByCount(points, 5);
    expect(samples).toHaveLength(5);
    expect(samples[0]).toEqual(points[0]);
    expect(samples[4].longitude).toBeCloseTo(points[49].longitude, 5);
  });
});

describe('prefetch place target', () => {
  it('uses matching scan count for small place targets', () => {
    expect(searchPointsForPlaceTarget(5)).toBe(5);
    expect(searchPointsForPlaceTarget(12)).toBe(12);
    expect(searchPointsForPlaceTarget(50)).toBeLessThanOrEqual(16);
  });

  it('hides raw Wikidata Q-ids from category labels', () => {
    expect(humanCategory('Q3957')).toBeUndefined();
    expect(humanCategory('museum')).toBe('museum');
  });
});

describe('poi scoring', () => {
  it('ranks a castle above a generic shop name', () => {
    const castle = interestingness(
      'Koules Fortress',
      'Venetian castle at the harbour of Heraklion.',
      400,
    );
    const weak = interestingness('Bus stop', 'A local bus stop.', 20);
    expect(scoreKeywords('Koules Fortress', 'Venetian castle')).toBeGreaterThan(0);
    expect(castle).toBeGreaterThan(weak);
  });
});
