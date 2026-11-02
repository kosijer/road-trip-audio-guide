import {
  extractPackageResultStdout,
  parsePackageResultStdout,
} from '../services/slingshot/parse';

const samplePackage = {
  ok: true,
  input: {
    latitude: 44.7866,
    longitude: 20.4489,
    language: 'en',
    mood: 'curious',
    mode: 'walk' as const,
    radiusMeters: 800,
  },
  weather: {
    summary: 'Cool and dry.',
    rainRisk: 'none',
    rainingNow: false,
    suggestions: [
      {
        title: 'Park stroll',
        why: 'Fresh air',
        indoorFriendly: false,
      },
    ],
    caution: null,
  },
  place: {
    pageid: 37329792,
    title: 'Hyde Park, Belgrade',
    lat: 44.7917,
    lon: 20.4487,
    distMeters: 567.3,
    why: 'Good walk',
    fitsWeather: true,
  },
  narration: {
    script: 'As you walk towards Hyde Park, enjoy the trees.',
    wordCount: 9,
    placeTitle: 'Hyde Park, Belgrade',
    language: 'en',
  },
};

describe('slingshot parse', () => {
  it('parses Package Result stdout JSON', () => {
    const parsed = parsePackageResultStdout(JSON.stringify(samplePackage));
    expect(parsed.ok).toBe(true);
    expect(parsed.place.title).toBe('Hyde Park, Belgrade');
    expect(parsed.narration.script).toMatch(/Hyde Park/);
  });

  it('rejects missing script', () => {
    expect(() =>
      parsePackageResultStdout(
        JSON.stringify({
          ...samplePackage,
          narration: { ...samplePackage.narration, script: '  ' },
        }),
      ),
    ).toThrow(/missing narration.script/);
  });

  it('extracts stdout from run allOutputs', () => {
    const run = {
      exec_metadata: {
        allOutputs: {
          'Road Guide v1abc': {
            'Package Result': {
              status: 'success',
              data: { stdout: JSON.stringify(samplePackage) },
            },
          },
        },
      },
    };
    const stdout = extractPackageResultStdout(run);
    const parsed = parsePackageResultStdout(stdout);
    expect(parsed.place.pageid).toBe(37329792);
  });
});
