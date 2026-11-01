import { classifyFromMapping, sanitizeCategories } from '../preferences/categoryMapping';
import {
  applyExposureOutcome,
  clampMult,
  decayed,
  evidenceCount,
  interestToStats,
  meanPreference,
  mulberry32,
  preferenceMultiplierForCategories,
  priorFor,
  statsToInterest,
} from '../preferences/learning';
import { ratingToOutcome } from '../preferences/migrate';
import { PREF } from '../preferences/preferences.config';
import {
  baseInterestDominates,
  rankCandidates,
} from '../preferences/rankCandidates';
import type {
  CategoryId,
  CategoryStats,
  ExposureRecord,
  PreferenceProfile,
  RankCandidate,
  SessionState,
} from '../preferences/types';

function exposure(
  partial: Partial<ExposureRecord> &
    Pick<ExposureRecord, 'outcome' | 'categories' | 'primaryCategory'>,
): ExposureRecord {
  return {
    id: 'e1',
    poiId: 'p1',
    sessionId: 's1',
    suggestedAt: 1,
    context: {
      daypart: 'afternoon',
      weekday: 1,
      season: 'summer',
      weatherOk: true,
      mode: 'walking',
      timeBudgetMin: null,
    },
    viable: true,
    statsApplied: false,
    ...partial,
  };
}

function makePool(): RankCandidate[] {
  const castles: RankCandidate[] = Array.from({ length: 10 }, (_, i) => ({
    id: `castle_${i}`,
    title: `Castle ${i}`,
    baseInterest: 1,
    categories: ['medieval_castles'] as CategoryId[],
    primaryCategory: 'medieval_castles' as CategoryId,
  }));
  const nature: RankCandidate[] = Array.from({ length: 10 }, (_, i) => ({
    id: `nature_${i}`,
    title: `Nature ${i}`,
    baseInterest: 1,
    categories: ['nature_viewpoints'] as CategoryId[],
    primaryCategory: 'nature_viewpoints' as CategoryId,
  }));
  return [...castles, ...nature];
}

describe('preferences learning & ranking', () => {
  it('bounds the preference multiplier to [0.7, 1.3]', () => {
    const now = Date.now();
    const stats: Record<string, CategoryStats> = {
      medieval_castles: {
        category: 'medieval_castles',
        alpha: 50,
        beta: 2,
        lastUpdated: now,
      },
      nature_viewpoints: {
        category: 'nature_viewpoints',
        alpha: 2,
        beta: 50,
        lastUpdated: now,
      },
    };
    const rng = mulberry32(42);
    for (let i = 0; i < 40; i++) {
      const hi = preferenceMultiplierForCategories(
        stats,
        ['medieval_castles'],
        'medieval_castles',
        now,
        rng,
      );
      const lo = preferenceMultiplierForCategories(
        stats,
        ['nature_viewpoints'],
        'nature_viewpoints',
        now,
        rng,
      );
      expect(hi).toBeGreaterThanOrEqual(PREF.MULT_MIN);
      expect(hi).toBeLessThanOrEqual(PREF.MULT_MAX);
      expect(lo).toBeGreaterThanOrEqual(PREF.MULT_MIN);
      expect(lo).toBeLessThanOrEqual(PREF.MULT_MAX);
      expect(clampMult(hi)).toBe(hi);
    }
  });

  it('lets sufficiently higher base interest dominate preferences', () => {
    // Worst case prefs: high*0.7 vs low*1.3 → need ratio ≥ 1.3/0.7 ≈ 1.857
    expect(baseInterestDominates(1.86, 1)).toBe(true);
    expect(baseInterestDominates(1.3, 1)).toBe(false);
    const now = Date.now();
    const stats: Record<string, CategoryStats> = {
      nature_viewpoints: {
        category: 'nature_viewpoints',
        alpha: 40,
        beta: 2,
        lastUpdated: now,
      },
      medieval_castles: {
        category: 'medieval_castles',
        alpha: 2,
        beta: 40,
        lastUpdated: now,
      },
    };
    const profile: PreferenceProfile = { stats, muted: [] };
    const session: SessionState = {
      mood: null,
      recentPrimaryCategories: [],
      selectionCount: 1,
      sessionId: 't',
    };
    const candidates: RankCandidate[] = [
      {
        id: 'weak_liked',
        title: 'Nature',
        baseInterest: 1,
        categories: ['nature_viewpoints'],
        primaryCategory: 'nature_viewpoints',
      },
      {
        id: 'strong_disliked',
        title: 'Castle',
        baseInterest: 2,
        categories: ['medieval_castles'],
        primaryCategory: 'medieval_castles',
      },
    ];
    let strongWins = 0;
    for (let seed = 0; seed < 30; seed++) {
      const result = rankCandidates(candidates, profile, session, {
        limit: 1,
        seed,
        now,
      });
      if (result.selected[0]?.id === 'strong_disliked') {
        strongWins += 1;
      }
    }
    expect(strongWins).toBe(30);
  });

  it('avoids premature lock-in after 3 castle likes (F1)', () => {
    const now = Date.now();
    let stats: Record<string, CategoryStats> = {
      medieval_castles: priorFor('medieval_castles', now),
      nature_viewpoints: priorFor('nature_viewpoints', now),
    };
    for (let i = 0; i < 3; i++) {
      const r = applyExposureOutcome(
        stats,
        exposure({
          id: `like_${i}`,
          outcome: 'ignored',
          categories: ['medieval_castles'],
          primaryCategory: 'medieval_castles',
          viable: true,
        }),
        'liked',
        now,
      );
      stats = r.stats;
    }
    const profile: PreferenceProfile = { stats, muted: [] };
    const pool = makePool();
    const recent: CategoryId[] = [];
    let naturePicks = 0;
    let selectionCount = 0;
    for (let i = 0; i < 20; i++) {
      const session: SessionState = {
        mood: null,
        recentPrimaryCategories: [...recent],
        selectionCount,
        sessionId: 'sim',
      };
      const result = rankCandidates(pool, profile, session, {
        limit: 1,
        seed: 1000 + i,
        now,
      });
      const pick = result.selected[0];
      expect(pick).toBeTruthy();
      if (pick.primaryCategory === 'nature_viewpoints') {
        naturePicks += 1;
      }
      recent.push(pick.primaryCategory);
      selectionCount += 1;
    }
    expect(naturePicks).toBeGreaterThanOrEqual(6);
  });

  it('keeps unused categories at prior (F2)', () => {
    const now = Date.now();
    const stats: Record<string, CategoryStats> = {
      medieval_castles: {
        category: 'medieval_castles',
        alpha: 8,
        beta: 2,
        lastUpdated: now,
      },
    };
    const nightlife = priorFor('nightlife_social', now);
    const d = decayed(nightlife, now + 200 * 86_400_000);
    expect(d.alpha).toBe(nightlife.alpha);
    expect(d.beta).toBe(nightlife.beta);
    expect(stats.nightlife_social).toBeUndefined();
  });

  it('ignores non-viable outcomes (F3)', () => {
    const now = Date.now();
    const before = priorFor('medieval_castles', now);
    const { stats } = applyExposureOutcome(
      { medieval_castles: before },
      exposure({
        outcome: 'ignored',
        categories: ['medieval_castles'],
        primaryCategory: 'medieval_castles',
        viable: false,
      }),
      'not_interested',
      now,
    );
    expect(stats.medieval_castles.alpha).toBe(before.alpha);
    expect(stats.medieval_castles.beta).toBe(before.beta);
  });

  it('treats ignored as neutral and skipped as +0.2 beta', () => {
    const now = Date.now();
    const base = priorFor('medieval_castles', now);
    const ignored = applyExposureOutcome(
      { medieval_castles: { ...base } },
      exposure({
        outcome: 'ignored',
        categories: ['medieval_castles'],
        primaryCategory: 'medieval_castles',
      }),
      'ignored',
      now,
    );
    expect(ignored.stats.medieval_castles.alpha).toBe(base.alpha);
    expect(ignored.stats.medieval_castles.beta).toBe(base.beta);

    const skipped = applyExposureOutcome(
      { medieval_castles: { ...base } },
      exposure({
        outcome: 'ignored',
        categories: ['medieval_castles'],
        primaryCategory: 'medieval_castles',
      }),
      'skipped',
      now,
    );
    expect(skipped.stats.medieval_castles.beta).toBeCloseTo(
      base.beta + 0.2,
      5,
    );
  });

  it('decays evidence toward prior over half-life', () => {
    const t0 = 1_000_000;
    const stats: CategoryStats = {
      category: 'medieval_castles',
      alpha: 8,
      beta: 2,
      lastUpdated: t0,
    };
    const d = decayed(stats, t0 + PREF.HALF_LIFE_DAYS * 86_400_000);
    // seeded prior alpha=3 for medieval_castles
    expect(d.alpha).toBeCloseTo(3 + (8 - 3) * 0.5, 5);
    expect(d.beta).toBeCloseTo(2 + (2 - 2) * 0.5, 5);
  });

  it('applies outcomes idempotently and can reverse like→dislike', () => {
    const now = Date.now();
    const base = priorFor('medieval_castles', now);
    let { stats, exposure: e1 } = applyExposureOutcome(
      { medieval_castles: { ...base } },
      exposure({
        outcome: 'ignored',
        categories: ['medieval_castles'],
        primaryCategory: 'medieval_castles',
      }),
      'liked',
      now,
    );
    const afterLike = stats.medieval_castles.alpha;
    ({ stats, exposure: e1 } = applyExposureOutcome(stats, e1, 'liked', now));
    expect(stats.medieval_castles.alpha).toBeCloseTo(afterLike, 5);

    ({ stats } = applyExposureOutcome(stats, e1, 'not_interested', now));
    expect(stats.medieval_castles.alpha).toBeCloseTo(base.alpha, 5);
    expect(stats.medieval_castles.beta).toBeCloseTo(base.beta + 1, 5);
  });

  it('mutes exclude a category from ranking', () => {
    const now = Date.now();
    const profile: PreferenceProfile = {
      stats: {},
      muted: ['medieval_castles'],
    };
    const session: SessionState = {
      mood: null,
      recentPrimaryCategories: [],
      selectionCount: 1,
      sessionId: 'm',
    };
    const result = rankCandidates(makePool(), profile, session, {
      limit: 5,
      seed: 7,
      now,
    });
    expect(
      result.selected.every(c => c.primaryCategory !== 'medieval_castles'),
    ).toBe(true);
    expect(
      result.debug.scores.some(
        s => s.id.startsWith('castle_') && s.excluded === 'muted',
      ),
    ).toBe(true);
  });

  it('mood boosts order without changing stats object identity for learning', () => {
    const now = Date.now();
    const stats = {
      nature_viewpoints: priorFor('nature_viewpoints', now),
      medieval_castles: priorFor('medieval_castles', now),
    };
    const snapshot = JSON.stringify(stats);
    const profile: PreferenceProfile = { stats, muted: [] };
    const withMood: SessionState = {
      mood: 'nature',
      recentPrimaryCategories: [],
      selectionCount: 1,
      sessionId: 'mood',
    };
    const result = rankCandidates(makePool(), profile, withMood, {
      limit: 1,
      seed: 3,
      now,
    });
    expect(result.selected[0]?.primaryCategory).toBe('nature_viewpoints');
    expect(JSON.stringify(stats)).toBe(snapshot);
  });

  it('nature mood prefers parks even when a market has higher baseInterest', () => {
    const now = Date.now();
    const profile: PreferenceProfile = { stats: {}, muted: [] };
    const session: SessionState = {
      mood: 'nature',
      recentPrimaryCategories: [],
      selectionCount: 1,
      sessionId: 'mood-filter',
    };
    const result = rankCandidates(
      [
        {
          id: 'market',
          title: 'Romford Market',
          baseInterest: 8,
          categories: ['local_culture_food'],
          primaryCategory: 'local_culture_food',
        },
        {
          id: 'park',
          title: 'Raphael Park',
          baseInterest: 3,
          categories: ['nature_viewpoints'],
          primaryCategory: 'nature_viewpoints',
        },
      ],
      profile,
      session,
      { limit: 1, seed: 1, now },
    );
    expect(result.selected[0]?.id).toBe('park');
    expect(
      result.debug.scores.some(s => s.id === 'market' && s.excluded === 'mood'),
    ).toBe(true);
  });

  it('enforces diversity of at most 2 consecutive same primary', () => {
    const now = Date.now();
    const profile: PreferenceProfile = { stats: {}, muted: [] };
    const recent: CategoryId[] = [
      'medieval_castles',
      'medieval_castles',
    ];
    const session: SessionState = {
      mood: null,
      recentPrimaryCategories: recent,
      selectionCount: 3,
      sessionId: 'div',
    };
    const result = rankCandidates(makePool(), profile, session, {
      limit: 1,
      seed: 11,
      now,
    });
    expect(result.selected[0]?.primaryCategory).not.toBe('medieval_castles');
    expect(result.debug.diversityAdjusted).toBe(true);
  });

  it('fires exploration every 5th selection', () => {
    const now = Date.now();
    const profile: PreferenceProfile = {
      stats: {
        medieval_castles: {
          category: 'medieval_castles',
          alpha: 20,
          beta: 2,
          lastUpdated: now,
        },
        nature_viewpoints: priorFor('nature_viewpoints', now),
      },
      muted: [],
    };
    const session: SessionState = {
      mood: null,
      recentPrimaryCategories: [],
      selectionCount: 5,
      sessionId: 'exp',
    };
    const result = rankCandidates(makePool(), profile, session, {
      limit: 1,
      seed: 99,
      now,
    });
    expect(result.debug.exploration).toBe(true);
  });

  it('maps free text and sanitizes LLM categories', () => {
    const mapped = classifyFromMapping({
      id: 'x',
      title: 'Edinburgh Castle',
      summary: 'A medieval fortress overlooking the city.',
      extractLength: 40,
    });
    expect(mapped?.primaryCategory).toBe('medieval_castles');
    const repaired = sanitizeCategories(
      ['medieval_castles', 'spaceship', 'nature_viewpoints'],
      'spaceship',
    );
    expect(repaired.categories).toEqual([
      'medieval_castles',
      'nature_viewpoints',
    ]);
    expect(repaired.primaryCategory).toBe('medieval_castles');
  });

  it('maps legacy ratings cautiously', () => {
    expect(ratingToOutcome(5)).toBe('liked');
    expect(ratingToOutcome(4)).toBe('liked');
    expect(ratingToOutcome(3)).toBe('ignored');
    expect(ratingToOutcome(2)).toBe('skipped');
    expect(ratingToOutcome(1)).toBe('skipped');
  });

  it('does not let narration quality touch stats (F4)', () => {
    // narration quality is stored on exposure only — applyExposureOutcome ignores it
    const now = Date.now();
    const base = priorFor('museums_galleries', now);
    const { stats } = applyExposureOutcome(
      { museums_galleries: { ...base } },
      {
        ...exposure({
          outcome: 'ignored',
          categories: ['museums_galleries'],
          primaryCategory: 'museums_galleries',
          narrationQuality: 1,
        }),
      },
      'ignored',
      now,
    );
    expect(stats.museums_galleries.alpha).toBe(base.alpha);
    expect(stats.museums_galleries.beta).toBe(base.beta);
  });

  it('reports evidence for confidence helper', () => {
    expect(evidenceCount(2, 2, 'architecture')).toBe(0);
    expect(evidenceCount(7, 2, 'architecture')).toBe(5);
  });

  it('round-trips interest sliders through Beta stats', () => {
    const stats = interestToStats('nature_viewpoints', 80);
    expect(statsToInterest(stats.alpha, stats.beta)).toBe(80);
    expect(meanPreference(stats.alpha, stats.beta)).toBeCloseTo(0.8, 2);
  });
});
