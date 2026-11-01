import {
  effectiveSpeedKmh,
  evaluateMoving,
  speedFromDisplacementKmh,
} from '../services/motion';
import type { LocationSample } from '../types';

describe('evaluateMoving', () => {
  const base = { latitude: 51.5, longitude: -0.1 };

  it('requires sustained speed samples', () => {
    expect(
      evaluateMoving({
        speedSamples: [30, 30],
        locations: [base, base],
        thresholdKmh: 25,
        neededSamples: 3,
      }),
    ).toBe(false);
  });

  it('passes high threshold on speed alone', () => {
    expect(
      evaluateMoving({
        speedSamples: [26, 28, 30],
        locations: [base, base, base],
        thresholdKmh: 25,
        neededSamples: 3,
      }),
    ).toBe(true);
  });

  it('rejects low-threshold standing still (GPS jitter)', () => {
    const jitter = [
      base,
      { latitude: base.latitude + 0.00002, longitude: base.longitude },
      { latitude: base.latitude + 0.00003, longitude: base.longitude },
    ];
    expect(
      evaluateMoving({
        speedSamples: [4, 5, 4],
        locations: jitter,
        thresholdKmh: 3,
        neededSamples: 3,
      }),
    ).toBe(false);
  });

  it('passes low-threshold when displaced enough', () => {
    // ~40 m north of base
    const moved = {
      latitude: base.latitude + 0.00036,
      longitude: base.longitude,
    };
    expect(
      evaluateMoving({
        speedSamples: [4, 5, 4],
        locations: [base, base, moved],
        thresholdKmh: 3,
        neededSamples: 3,
      }),
    ).toBe(true);
  });
});

describe('effectiveSpeedKmh', () => {
  function sample(
    latitude: number,
    longitude: number,
    speedKmh: number,
    timestamp: number,
  ): LocationSample {
    return { latitude, longitude, speedKmh, timestamp, accuracyM: 10 };
  }

  it('falls back to displacement when GPS speed is 0', () => {
    const prev = sample(51.5, -0.1, 0, 1_000);
    // ~250 m north in 15 s ≈ 60 km/h
    const next = sample(51.5 + 0.00225, -0.1, 0, 16_000);
    const derived = speedFromDisplacementKmh(prev, next);
    expect(derived).toBeGreaterThan(50);
    expect(effectiveSpeedKmh(prev, next)).toBeCloseTo(derived, 5);
  });

  it('keeps GPS speed when present and higher', () => {
    const prev = sample(51.5, -0.1, 0, 1_000);
    const next = sample(51.5 + 0.0001, -0.1, 80, 16_000);
    expect(effectiveSpeedKmh(prev, next)).toBe(80);
  });

  it('returns device speed when there is no previous sample', () => {
    const next = sample(51.5, -0.1, 12, 1_000);
    expect(effectiveSpeedKmh(undefined, next)).toBe(12);
  });
});
