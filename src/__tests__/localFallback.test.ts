import { localNarration } from '../services/narration/localFallback';
import type { Poi } from '../types';

function poi(partial: Partial<Poi> & Pick<Poi, 'id' | 'title'>): Poi {
  return {
    summary: partial.summary ?? 'A historic place in the city centre.',
    location: { latitude: 51.5, longitude: -0.12 },
    source: 'wikipedia',
    extractLength: 120,
    isOutdoor: true,
    isIndoorVenue: false,
    distanceM: 200,
    ...partial,
  };
}

describe('localNarration', () => {
  it('builds a single-place spoken script in English', () => {
    const text = localNarration(
      [poi({ id: '1', title: 'Trafalgar Square', summary: 'A public square in Westminster.' })],
      'driving',
      [],
      'en',
    );
    expect(text).toContain('Trafalgar Square');
    expect(text).toContain('public square');
    expect(text).toContain('Nearby is');
  });

  it('covers multiple walking places in Serbian', () => {
    const text = localNarration(
      [
        poi({ id: '1', title: 'Trafalgar Square' }),
        poi({ id: '2', title: 'National Gallery' }),
      ],
      'walking',
      [],
      'sr',
    );
    expect(text).toContain('Trafalgar Square');
    expect(text).toContain('National Gallery');
    expect(text).toContain('Prvo');
  });
});
