import { PREF } from './preferences.config';
import {
  clampMult,
  moodCategories,
  mulberry32,
  posteriorVariance,
  preferenceMultiplierForCategories,
  priorFor,
  decayed,
  type Rng,
} from './learning';
import type {
  CategoryId,
  PreferenceProfile,
  RankCandidate,
  RankDebugInfo,
  SessionMood,
  SessionState,
} from './types';

export type RankResult = {
  ordered: RankCandidate[];
  selected: RankCandidate[];
  debug: RankDebugInfo;
};

function moodBoostFor(
  mood: SessionMood,
  primary: CategoryId,
): number {
  if (!mood || mood === 'surprise') {
    return 1;
  }
  return moodCategories(mood).includes(primary) ? PREF.MOOD_BOOST : 1;
}

export function rankCandidates(
  candidates: RankCandidate[],
  profile: PreferenceProfile,
  session: SessionState,
  opts?: {
    now?: number;
    limit?: number;
    rng?: Rng;
    seed?: number;
  },
): RankResult {
  const now = opts?.now ?? Date.now();
  const limit = opts?.limit ?? 1;
  const rng = opts?.rng ?? (opts?.seed != null ? mulberry32(opts.seed) : Math.random);
  const muted = new Set(profile.muted);
  const cooldownMs = PREF.POI_COOLDOWN_DAYS * 86_400_000;

  const debugScores: RankDebugInfo['scores'] = [];
  const viable: RankCandidate[] = [];

  for (const c of candidates) {
    if (muted.has(c.primaryCategory)) {
      debugScores.push({
        id: c.id,
        baseInterest: c.baseInterest,
        multiplier: 1,
        moodBoost: 1,
        finalScore: 0,
        excluded: 'muted',
      });
      continue;
    }
    if (c.lastExposedAt != null && now - c.lastExposedAt < cooldownMs) {
      debugScores.push({
        id: c.id,
        baseInterest: c.baseInterest,
        multiplier: 1,
        moodBoost: 1,
        finalScore: 0,
        excluded: 'cooldown',
      });
      continue;
    }
    viable.push(c);
  }

  // Session mood is a soft shortlist: if any mood-matching places exist,
  // only those compete. Boost alone cannot beat a high Clef/heuristic base.
  const moodCats = new Set(moodCategories(session.mood));
  const moodMatched =
    moodCats.size > 0
      ? viable.filter(c => moodCats.has(c.primaryCategory))
      : [];
  const scoringPool = moodMatched.length > 0 ? moodMatched : viable;

  const scored = scoringPool.map(c => {
    const multiplier = preferenceMultiplierForCategories(
      profile.stats,
      c.categories,
      c.primaryCategory,
      now,
      rng,
    );
    const moodBoost = moodBoostFor(session.mood, c.primaryCategory);
    const finalScore = c.baseInterest * multiplier * moodBoost;
    debugScores.push({
      id: c.id,
      baseInterest: c.baseInterest,
      multiplier: clampMult(multiplier),
      moodBoost,
      finalScore,
    });
    return { c, finalScore, multiplier, moodBoost };
  });

  // Keep excluded non-mood candidates visible in debug.
  if (moodMatched.length > 0) {
    for (const c of viable) {
      if (moodCats.has(c.primaryCategory)) {
        continue;
      }
      debugScores.push({
        id: c.id,
        baseInterest: c.baseInterest,
        multiplier: 1,
        moodBoost: 1,
        finalScore: 0,
        excluded: 'mood',
      });
    }
  }

  scored.sort((a, b) => b.finalScore - a.finalScore);

  const bases = scored.map(s => s.c.baseInterest).sort((a, b) => a - b);
  const medianBase =
    bases.length === 0
      ? 0
      : bases.length % 2 === 1
        ? bases[(bases.length - 1) / 2]
        : (bases[bases.length / 2 - 1] + bases[bases.length / 2]) / 2;
  const explorationFloor = 0.5 * medianBase;

  const selected: RankCandidate[] = [];
  const recent = [...session.recentPrimaryCategories];
  let explorationFired = false;
  let diversityAdjusted = false;
  const nextCount = session.selectionCount;

  for (let i = 0; i < limit; i++) {
    const pickIndex = nextCount + i;
    const wantExploration =
      session.mood === 'surprise' ||
      (pickIndex > 0 && pickIndex % PREF.EXPLORATION_EVERY_N === 0);

    let pool = scored.filter(s => !selected.some(x => x.id === s.c.id));
    if (pool.length === 0) {
      break;
    }

    // Diversity: avoid >2 consecutive same primary when alternatives exist
    const lastTwo = recent.slice(-PREF.MAX_CONSECUTIVE_SAME_CATEGORY);
    if (
      lastTwo.length === PREF.MAX_CONSECUTIVE_SAME_CATEGORY &&
      lastTwo.every(c => c === lastTwo[0])
    ) {
      const alt = pool.filter(s => s.c.primaryCategory !== lastTwo[0]);
      if (alt.length > 0) {
        pool = alt;
        diversityAdjusted = true;
      }
    }

    let pick = pool[0];
    if (wantExploration) {
      const explorePool = pool.filter(s => s.c.baseInterest >= explorationFloor);
      const from = explorePool.length > 0 ? explorePool : pool;
      let bestVar = -1;
      for (const s of from) {
        const st =
          profile.stats[s.c.primaryCategory] ??
          priorFor(s.c.primaryCategory, now);
        const d = decayed(st, now);
        const v = posteriorVariance(d.alpha, d.beta);
        if (v > bestVar) {
          bestVar = v;
          pick = s;
        }
      }
      explorationFired = true;
    }

    selected.push(pick.c);
    recent.push(pick.c.primaryCategory);
  }

  return {
    ordered: scored.map(s => s.c),
    selected,
    debug: {
      exploration: explorationFired,
      diversityAdjusted,
      scores: debugScores,
    },
  };
}

/**
 * Ratio at which higher baseInterest always beats lower after [MULT_MIN, MULT_MAX]
 * preference multipliers (worst case: high*MIN vs low*MAX).
 */
export const BASE_DOMINANCE_RATIO = PREF.MULT_MAX / PREF.MULT_MIN;

/** True when highBase cannot be overtaken by preference multipliers alone. */
export function baseInterestDominates(
  highBase: number,
  lowBase: number,
): boolean {
  return highBase >= lowBase * BASE_DOMINANCE_RATIO;
}
