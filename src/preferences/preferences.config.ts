import type { CategoryId } from './types';

export const PREF = {
  PRIOR_ALPHA: 2,
  PRIOR_BETA: 2,
  HALF_LIFE_DAYS: 75,
  MIN_EVIDENCE: 5,
  MULT_MIN: 0.7,
  MULT_MAX: 1.3,
  WEIGHT_LIKED: 1.0,
  WEIGHT_VISITED: 1.5,
  WEIGHT_NOT_INTERESTED: 1.0,
  WEIGHT_SKIPPED: 0.2,
  SECONDARY_CATEGORY_WEIGHT: 0.5,
  PRIMARY_MULT_WEIGHT: 2 / 3,
  SECONDARY_MULT_WEIGHT: 1 / 3,
  MAX_CONSECUTIVE_SAME_CATEGORY: 2,
  EXPLORATION_EVERY_N: 5,
  MOOD_BOOST: 1.5,
  POI_COOLDOWN_DAYS: 30,
  PROFILE_SUMMARY_EVERY_N_EXPOSURES: 25,
  PROFILE_SUMMARY_MIN_INTERVAL_MS: 24 * 60 * 60 * 1000,
} as const;

/** Soft history seed — user leans history over market towns. */
export const SEEDED_PRIORS: Partial<
  Record<CategoryId, { alpha: number; beta: number }>
> = {
  ancient_history: { alpha: 3, beta: 2 },
  medieval_castles: { alpha: 3, beta: 2 },
  ww2_military: { alpha: 3, beta: 2 },
};

export const CATEGORY_IDS = [
  'ancient_history',
  'medieval_castles',
  'ww2_military',
  'religious_sites',
  'nature_viewpoints',
  'beaches_coast',
  'museums_galleries',
  'famous_people',
  'architecture',
  'local_culture_food',
  'modern_landmarks',
  'nightlife_social',
  'other',
] as const;

export const ERA_IDS = [
  'prehistoric',
  'antiquity',
  'medieval',
  'early_modern',
  '19th_century',
  '20th_century',
  'contemporary',
  'unknown',
] as const;
