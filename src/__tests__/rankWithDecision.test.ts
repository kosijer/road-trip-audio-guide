import type { Poi } from '../types';
import {
  reorderByProbabilities,
  selectionLimit,
  selectPoisForNarration,
} from '../services/poi/rankWithDecision';

jest.mock('../services/decision/clef', () => ({
  isClefConfigured: jest.fn(() => false),
  runClef: jest.fn(),
  asChoiceAnswer: jest.requireActual('../services/decision/clef').asChoiceAnswer,
}));

const clef = jest.requireMock('../services/decision/clef') as {
  isClefConfigured: jest.Mock;
  runClef: jest.Mock;
};

function poi(partial: Partial<Poi> & Pick<Poi, 'id' | 'title'>): Poi {
  return {
    summary: partial.summary ?? 'A place.',
    location: partial.location ?? { latitude: 44.8, longitude: 20.4 },
    source: partial.source ?? 'wikipedia',
    extractLength: partial.extractLength ?? 200,
    isOutdoor: partial.isOutdoor ?? false,
    isIndoorVenue: partial.isIndoorVenue ?? false,
    distanceM: partial.distanceM ?? 500,
    ...partial,
  };
}

describe('rankWithDecision', () => {
  beforeEach(() => {
    clef.isClefConfigured.mockReturnValue(false);
    clef.runClef.mockReset();
  });

  it('uses driving/walking selection sizes', () => {
    expect(selectionLimit('driving')).toBe(1);
    expect(selectionLimit('walking')).toBe(3);
  });

  it('reorders by Clef probabilities', () => {
    const a = poi({ id: 'a', title: 'Bus stop', summary: 'Local stop.' });
    const b = poi({
      id: 'b',
      title: 'Kalemegdan Fortress',
      summary: 'Historic fortress and park.',
      extractLength: 800,
    });
    const shortlist = [a, b];
    const aliasToPoi = new Map([
      ['p0', a],
      ['p1', b],
    ]);
    const ranked = reorderByProbabilities(shortlist, aliasToPoi, {
      p0: 0.1,
      p1: 0.9,
    });
    expect(ranked.map(p => p.id)).toEqual(['b', 'a']);
  });

  it('falls back to heuristic order when Clef is off', async () => {
    const fortress = poi({
      id: 'fort',
      title: 'Koules Fortress',
      summary: 'Venetian castle at the harbour.',
      extractLength: 500,
      distanceM: 900,
    });
    const bus = poi({
      id: 'bus',
      title: 'Bus stop',
      summary: 'A local bus stop.',
      extractLength: 40,
      distanceM: 50,
    });
    const selected = await selectPoisForNarration([bus, fortress], 'driving');
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe('fort');
    expect(clef.runClef).not.toHaveBeenCalled();
  });

  it('reorders via Clef probabilities when configured', async () => {
    clef.isClefConfigured.mockReturnValue(true);
    // After heuristic rank, museum is p0 and shop is p1.
    // Clef deliberately prefers the shop (p1) so we can assert a flip.
    clef.runClef.mockResolvedValue({
      model: 'clef',
      answers: {
        pick: {
          type: 'choice',
          choice: 'p1',
          confidence: 0.8,
          probabilities: { p0: 0.2, p1: 0.8 },
        },
      },
    });

    const shop = poi({
      id: 'weak',
      title: 'Shop',
      summary: 'Small shop.',
      extractLength: 30,
    });
    const museum = poi({
      id: 'strong',
      title: 'Museum',
      summary: 'National museum of history.',
      extractLength: 100,
      category: 'museum',
    });

    const walking = await selectPoisForNarration([shop, museum], 'walking');
    expect(clef.runClef).toHaveBeenCalled();
    expect(walking.map(p => p.id)).toEqual(['weak', 'strong']);
  });

  it('keeps heuristic order if Clef throws', async () => {
    clef.isClefConfigured.mockReturnValue(true);
    clef.runClef.mockRejectedValue(new Error('network'));

    const fortress = poi({
      id: 'fort',
      title: 'Castle',
      summary: 'Ancient castle ruins and fortress.',
      extractLength: 600,
    });
    const shop = poi({
      id: 'shop',
      title: 'Shop',
      summary: 'A shop.',
      extractLength: 20,
    });

    const selected = await selectPoisForNarration([shop, fortress], 'driving');
    expect(selected[0]?.id).toBe('fort');
  });
});
