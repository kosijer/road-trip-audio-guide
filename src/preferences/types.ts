import type { CATEGORY_IDS, ERA_IDS } from './preferences.config';

export type CategoryId = (typeof CATEGORY_IDS)[number];
export type EraId = (typeof ERA_IDS)[number];

export type ExposureOutcome =
  | 'liked'
  | 'not_interested'
  | 'skipped'
  | 'visited'
  | 'ignored';

export type Daypart = 'morning' | 'afternoon' | 'evening' | 'night';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type PreferenceMode = 'driving' | 'walking' | 'browse';
export type SessionMood = 'history' | 'nature' | 'surprise' | null;

export type ExposureContext = {
  daypart: Daypart;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  season: Season;
  weatherOk: boolean | null;
  mode: PreferenceMode;
  timeBudgetMin: number | null;
};

export type CategoryStats = {
  category: CategoryId;
  alpha: number;
  beta: number;
  lastUpdated: number;
};

export type PoiClassification = {
  poiId: string;
  categories: CategoryId[];
  primaryCategory: CategoryId;
  era: EraId;
  source: 'mapping' | 'llm';
  classifiedAt: number;
};

export type ExposureRecord = {
  id: string;
  poiId: string;
  sessionId: string;
  suggestedAt: number;
  context: ExposureContext;
  viable: boolean;
  blockedReason?: string;
  outcome: ExposureOutcome;
  outcomeAt?: number;
  dwellSeconds?: number;
  narrationQuality?: 1 | 2 | 3 | 4 | 5;
  statsApplied: boolean;
  /** Categories snapshotted at exposure time for reverse updates. */
  categories: CategoryId[];
  primaryCategory: CategoryId;
};

export type RankCandidate = {
  id: string;
  title: string;
  baseInterest: number;
  categories: CategoryId[];
  primaryCategory: CategoryId;
  lastExposedAt?: number;
};

export type PreferenceProfile = {
  stats: Record<string, CategoryStats>;
  muted: CategoryId[];
  summaryText?: string;
  summaryGeneratedAt?: number;
  summaryBasedOnExposures?: number;
};

export type SessionState = {
  mood: SessionMood;
  recentPrimaryCategories: CategoryId[];
  selectionCount: number;
  sessionId: string;
};

export type RankDebugInfo = {
  exploration: boolean;
  diversityAdjusted: boolean;
  scores: Array<{
    id: string;
    baseInterest: number;
    multiplier: number;
    moodBoost: number;
    finalScore: number;
    excluded?: string;
  }>;
};
