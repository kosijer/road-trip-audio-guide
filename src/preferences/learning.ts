import { PREF, SEEDED_PRIORS } from './preferences.config';
import type {
  CategoryId,
  CategoryStats,
  ExposureOutcome,
  ExposureRecord,
} from './types';

export function priorFor(category: CategoryId, now = Date.now()): CategoryStats {
  const seed = SEEDED_PRIORS[category];
  return {
    category,
    alpha: seed?.alpha ?? PREF.PRIOR_ALPHA,
    beta: seed?.beta ?? PREF.PRIOR_BETA,
    lastUpdated: now,
  };
}

export function decayed(
  stats: CategoryStats,
  now: number,
): { alpha: number; beta: number } {
  const priorA = SEEDED_PRIORS[stats.category]?.alpha ?? PREF.PRIOR_ALPHA;
  const priorB = SEEDED_PRIORS[stats.category]?.beta ?? PREF.PRIOR_BETA;
  const days = (now - stats.lastUpdated) / 86_400_000;
  if (days <= 0) {
    return { alpha: stats.alpha, beta: stats.beta };
  }
  const f = Math.pow(0.5, days / PREF.HALF_LIFE_DAYS);
  return {
    alpha: priorA + (stats.alpha - priorA) * f,
    beta: priorB + (stats.beta - priorB) * f,
  };
}

export function evidenceCount(alpha: number, beta: number, category: CategoryId): number {
  const priorA = SEEDED_PRIORS[category]?.alpha ?? PREF.PRIOR_ALPHA;
  const priorB = SEEDED_PRIORS[category]?.beta ?? PREF.PRIOR_BETA;
  return Math.max(0, alpha + beta - (priorA + priorB));
}

export function confidence(alpha: number, beta: number, category: CategoryId): number {
  return Math.min(1, evidenceCount(alpha, beta, category) / PREF.MIN_EVIDENCE);
}

export function meanPreference(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

export function posteriorVariance(alpha: number, beta: number): number {
  const s = alpha + beta;
  return (alpha * beta) / (s * s * (s + 1));
}

/** Seedable RNG for tests. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gamma via Marsaglia — enough for Thompson sampling in-app. */
function sampleGamma(shape: number, rng: Rng): number {
  if (shape < 1) {
    const u = rng();
    return sampleGamma(1 + shape, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

export function sampleBeta(alpha: number, beta: number, rng: Rng = Math.random): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  return x / (x + y);
}

function weightForOutcome(outcome: ExposureOutcome): number {
  switch (outcome) {
    case 'liked':
      return PREF.WEIGHT_LIKED;
    case 'visited':
      return PREF.WEIGHT_VISITED;
    case 'not_interested':
      return PREF.WEIGHT_NOT_INTERESTED;
    case 'skipped':
      return PREF.WEIGHT_SKIPPED;
    case 'ignored':
      return 0;
    default:
      return 0;
  }
}

function isPositive(outcome: ExposureOutcome): boolean {
  return outcome === 'liked' || outcome === 'visited';
}

function categoryWeights(
  categories: CategoryId[],
  primary: CategoryId,
): Array<{ category: CategoryId; w: number }> {
  return categories
    .filter(c => c !== 'other')
    .map(category => ({
      category,
      w:
        category === primary
          ? 1
          : PREF.SECONDARY_CATEGORY_WEIGHT,
    }));
}

export function applyOutcomeDelta(
  statsMap: Record<string, CategoryStats>,
  exposure: Pick<
    ExposureRecord,
    'categories' | 'primaryCategory' | 'outcome' | 'viable'
  >,
  direction: 1 | -1,
  now = Date.now(),
): Record<string, CategoryStats> {
  if (!exposure.viable || exposure.outcome === 'ignored') {
    return statsMap;
  }
  const baseW = weightForOutcome(exposure.outcome);
  if (baseW === 0) {
    return statsMap;
  }
  const next = { ...statsMap };
  const positive = isPositive(exposure.outcome);
  for (const { category, w } of categoryWeights(
    exposure.categories,
    exposure.primaryCategory,
  )) {
    const current = next[category] ?? priorFor(category, now);
    const d = decayed(current, now);
    const delta = baseW * w * direction;
    next[category] = {
      category,
      alpha: Math.max(
        SEEDED_PRIORS[category]?.alpha ?? PREF.PRIOR_ALPHA,
        d.alpha + (positive ? delta : 0),
      ),
      beta: Math.max(
        SEEDED_PRIORS[category]?.beta ?? PREF.PRIOR_BETA,
        d.beta + (positive ? 0 : delta),
      ),
      lastUpdated: now,
    };
  }
  return next;
}

/**
 * Idempotent outcome application. Changing outcomes reverses the previous delta.
 */
export function applyExposureOutcome(
  statsMap: Record<string, CategoryStats>,
  exposure: ExposureRecord,
  newOutcome: ExposureOutcome,
  now = Date.now(),
): { stats: Record<string, CategoryStats>; exposure: ExposureRecord } {
  let stats = { ...statsMap };
  if (exposure.statsApplied && exposure.outcome !== 'ignored') {
    stats = applyOutcomeDelta(stats, exposure, -1, now);
  }
  const updated: ExposureRecord = {
    ...exposure,
    outcome: newOutcome,
    outcomeAt: now,
    statsApplied: false,
  };
  if (updated.viable && newOutcome !== 'ignored') {
    stats = applyOutcomeDelta(stats, updated, 1, now);
    updated.statsApplied = true;
  }
  return { stats, exposure: updated };
}

export function preferenceMultiplierForCategories(
  statsMap: Record<string, CategoryStats>,
  categories: CategoryId[],
  primary: CategoryId,
  now: number,
  rng: Rng = Math.random,
): number {
  const usable = categories.filter(c => c !== 'other');
  if (usable.length === 0) {
    return 1;
  }
  const primaryMult = (() => {
    const s = statsMap[primary] ?? priorFor(primary, now);
    const d = decayed(s, now);
    const theta = sampleBeta(d.alpha, d.beta, rng);
    const conf = confidence(d.alpha, d.beta, primary);
    const thetaEff = 0.5 + (theta - 0.5) * conf;
    return PREF.MULT_MIN + (PREF.MULT_MAX - PREF.MULT_MIN) * thetaEff;
  })();

  const secondaries = usable.filter(c => c !== primary);
  if (secondaries.length === 0) {
    return clampMult(primaryMult);
  }
  let secSum = 0;
  for (const cat of secondaries) {
    const s = statsMap[cat] ?? priorFor(cat, now);
    const d = decayed(s, now);
    const theta = sampleBeta(d.alpha, d.beta, rng);
    const conf = confidence(d.alpha, d.beta, cat);
    const thetaEff = 0.5 + (theta - 0.5) * conf;
    secSum += PREF.MULT_MIN + (PREF.MULT_MAX - PREF.MULT_MIN) * thetaEff;
  }
  const secAvg = secSum / secondaries.length;
  return clampMult(
    PREF.PRIMARY_MULT_WEIGHT * primaryMult +
      PREF.SECONDARY_MULT_WEIGHT * secAvg,
  );
}

export function clampMult(value: number): number {
  return Math.min(PREF.MULT_MAX, Math.max(PREF.MULT_MIN, value));
}

export function moodCategories(mood: 'history' | 'nature' | 'surprise' | null): CategoryId[] {
  if (mood === 'history') {
    return ['ancient_history', 'medieval_castles', 'ww2_military', 'famous_people'];
  }
  if (mood === 'nature') {
    return ['nature_viewpoints', 'beaches_coast'];
  }
  return [];
}
