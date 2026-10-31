import {
  parseNarratedEntries,
  recentNarratedIds,
} from '../services/store';

describe('narrated cooldown', () => {
  const hour = 60 * 60 * 1000;

  it('parses legacy string ids as recently narrated', () => {
    const now = 1_700_000_000_000;
    const { entries, legacy } = parseNarratedEntries(
      JSON.stringify(['church', 'park']),
      now,
    );
    expect(legacy).toBe(true);
    expect(entries).toEqual([
      { id: 'church', at: now },
      { id: 'park', at: now },
    ]);
  });

  it('parses timed entries', () => {
    const { entries, legacy } = parseNarratedEntries(
      JSON.stringify([{ id: 'church', at: 10 }, { id: 'park', at: 20 }]),
    );
    expect(legacy).toBe(false);
    expect(entries.map(e => e.id)).toEqual(['church', 'park']);
  });

  it('skips places only while inside the cooldown window', () => {
    const now = 10 * hour;
    const entries = [
      { id: 'church', at: now - hour },
      { id: 'museum', at: now - 7 * hour },
    ];
    expect(recentNarratedIds(entries, 6 * hour, now)).toEqual(['church']);
  });
});
