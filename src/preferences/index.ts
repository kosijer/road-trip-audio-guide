export { PREF, CATEGORY_IDS } from './preferences.config';
export * from './types';
export {
  classifyFromMapping,
  sanitizeCategories,
  isCategoryId,
} from './categoryMapping';
export {
  applyExposureOutcome,
  decayed,
  evidenceCount,
  confidence,
  meanPreference,
  mulberry32,
  preferenceMultiplierForCategories,
  clampMult,
  priorFor,
  moodCategories,
} from './learning';
export { rankCandidates, baseInterestDominates } from './rankCandidates';
export { getOrClassifyPoi, classifyMany, repairLlmClassification } from './classify';
export { buildExposureContext, isNightlifeViable } from './context';
export { migrateLegacyRatingsIfNeeded, ratingToOutcome } from './migrate';
export {
  ensureStatsInitialized,
  getPreferenceProfile,
  getSessionState,
  setSessionMood,
  recordExposure,
  setExposureOutcome,
  setNarrationQuality,
  lastExposureForPoi,
  resetPreferenceProfile,
  setCategoryMuted,
  getMutedCategories,
  getExposures,
} from './preferenceStore';
