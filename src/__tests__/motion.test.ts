import { evaluateMoving } from '../services/motion';

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
