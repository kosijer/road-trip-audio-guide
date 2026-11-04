import {
  announceLeadMinutes,
  bearingDeg,
  etaMinutes,
  evaluateCorridor,
  filterInCone,
  headingFromSamples,
  lookaheadDistanceM,
  minUsefulEtaMinutes,
  relativeBearingDeg,
  selectCorridorTier,
  sideFromRelative,
} from '../services/headingCorridor';
import type { LocationSample } from '../types';

const origin = { latitude: 51.5, longitude: -0.1 };

function offsetNorth(meters: number) {
  return {
    latitude: origin.latitude + meters / 111_320,
    longitude: origin.longitude,
  };
}

function offsetEast(meters: number) {
  const cos = Math.cos((origin.latitude * Math.PI) / 180);
  return {
    latitude: origin.latitude,
    longitude: origin.longitude + meters / (111_320 * cos),
  };
}

describe('bearing / relative', () => {
  it('bearing north is ~0', () => {
    expect(bearingDeg(origin, offsetNorth(1000))).toBeCloseTo(0, 0);
  });

  it('relative wraps into (-180, 180]', () => {
    expect(relativeBearingDeg(350, 10)).toBeCloseTo(20, 5);
    expect(relativeBearingDeg(10, 350)).toBeCloseTo(-20, 5);
  });

  it('sideFromRelative', () => {
    expect(sideFromRelative(0)).toBe('ahead');
    expect(sideFromRelative(-30)).toBe('left');
    expect(sideFromRelative(40)).toBe('right');
  });
});

describe('headingFromSamples', () => {
  it('returns null when span is too short', () => {
    const samples: LocationSample[] = [
      { ...origin, speedKmh: 30, timestamp: 1 },
      { ...offsetNorth(5), speedKmh: 30, timestamp: 2 },
    ];
    expect(headingFromSamples(samples)).toBeNull();
  });

  it('returns north heading when moving north', () => {
    const samples: LocationSample[] = [
      { ...origin, speedKmh: 40, timestamp: 1 },
      { ...offsetNorth(80), speedKmh: 40, timestamp: 2 },
      { ...offsetNorth(160), speedKmh: 40, timestamp: 3 },
    ];
    expect(headingFromSamples(samples)).toBeCloseTo(0, 0);
  });
});

describe('cones', () => {
  const narrow = { halfAngleDeg: 25, maxDistanceM: 4000 };
  const wide = { halfAngleDeg: 60, maxDistanceM: 10000 };

  it('accepts ahead in narrow', () => {
    const hit = evaluateCorridor(origin, 0, offsetNorth(2000), narrow);
    expect(hit.inCone).toBe(true);
    expect(hit.side).toBe('ahead');
  });

  it('rejects behind', () => {
    const south = {
      latitude: origin.latitude - 2000 / 111_320,
      longitude: origin.longitude,
    };
    expect(evaluateCorridor(origin, 0, south, wide).inCone).toBe(false);
  });

  it('off-side only in wide', () => {
    // ~45° east of north at ~2 km
    const target = {
      latitude: origin.latitude + 1400 / 111_320,
      longitude:
        origin.longitude +
        1400 / (111_320 * Math.cos((origin.latitude * Math.PI) / 180)),
    };
    const narrowHit = evaluateCorridor(origin, 0, target, narrow);
    const wideHit = evaluateCorridor(origin, 0, target, wide);
    expect(narrowHit.inCone).toBe(false);
    expect(wideHit.inCone).toBe(true);
    expect(wideHit.side).toBe('right');
  });

  it('selectCorridorTier falls back to wide', () => {
    const sideOnly = [
      {
        id: 'a',
        location: offsetEast(1500),
      },
    ];
    // East of heading 0 is 90° — outside wide 60°, so force a ~50° target.
    const target = {
      id: 'b',
      location: {
        latitude: origin.latitude + 2000 / 111_320,
        longitude:
          origin.longitude +
          2000 / (111_320 * Math.cos((origin.latitude * Math.PI) / 180)),
      },
    };
    const result = selectCorridorTier(origin, 0, [target], narrow, wide);
    expect(result.tier).toBe('wide');
    expect(result.hits).toHaveLength(1);

    const empty = selectCorridorTier(origin, 0, sideOnly, narrow, wide);
    expect(empty.tier).toBe('none');
  });

  it('filterInCone keeps only in-cone', () => {
    const items = [
      { id: 'n', location: offsetNorth(1000) },
      { id: 's', location: { latitude: origin.latitude - 0.01, longitude: origin.longitude } },
    ];
    const hits = filterInCone(origin, 0, items, narrow);
    expect(hits.map(h => h.id)).toEqual(['n']);
  });
});

describe('eta / lookahead', () => {
  it('etaMinutes scales with distance', () => {
    expect(etaMinutes(3000, 60)).toBe(3);
    expect(etaMinutes(100, 60)).toBe(1);
  });

  it('lookaheadDistanceM uses speed', () => {
    // 36 km/h = 10 m/s × 5 min = 3000 m
    expect(lookaheadDistanceM(36, 5)).toBeCloseTo(3000, 0);
  });

  it('announceLeadMinutes grows with speed', () => {
    const city = announceLeadMinutes(48);
    const highway = announceLeadMinutes(113); // ~70 mph
    expect(city.narrowMin).toBeLessThan(8);
    expect(highway.narrowMin).toBeGreaterThanOrEqual(14);
    expect(highway.wideMin).toBeGreaterThan(highway.narrowMin);
    expect(minUsefulEtaMinutes(city.narrowMin)).toBeLessThan(
      city.narrowMin,
    );
    // Keep enough lead for teaser + hold (~2.5+ min), not “already beside it”.
    expect(minUsefulEtaMinutes(city.narrowMin)).toBeGreaterThanOrEqual(2.5);
  });
});
