import { prefetchBatchUsableForDrive } from '../services/prefetch';
import type { PrefetchBatch } from '../types';

function batch(partial: Partial<PrefetchBatch>): PrefetchBatch {
  return {
    origin: 'A',
    destination: 'B',
    placeTarget: 5,
    sampleCount: 2,
    createdAt: 1,
    pois: [
      {
        id: '1',
        title: 'Place',
        summary: 'x',
        latitude: 1,
        longitude: 2,
        source: 'wikipedia',
      },
    ],
    ...partial,
  };
}

describe('prefetchBatchUsableForDrive', () => {
  it('rejects empty / missing', () => {
    expect(prefetchBatchUsableForDrive(null)).toBe(false);
    expect(prefetchBatchUsableForDrive(batch({ pois: [] }))).toBe(false);
  });

  it('rejects walking loops so they cannot feed Drive', () => {
    expect(
      prefetchBatchUsableForDrive(
        batch({ kind: 'loop', mode: 'walking' }),
      ),
    ).toBe(false);
  });

  it('allows driving loops and A→B corridors', () => {
    expect(
      prefetchBatchUsableForDrive(
        batch({ kind: 'loop', mode: 'driving' }),
      ),
    ).toBe(true);
    expect(
      prefetchBatchUsableForDrive(batch({ kind: 'corridor' })),
    ).toBe(true);
    expect(prefetchBatchUsableForDrive(batch({}))).toBe(true);
  });
});
