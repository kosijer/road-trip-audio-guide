import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyExposureOutcome, interestToStats, priorFor } from './learning';
import { CATEGORY_IDS, PREF } from './preferences.config';
import type {
  CategoryId,
  CategoryStats,
  ExposureOutcome,
  ExposureRecord,
  PoiClassification,
  PreferenceProfile,
  SessionMood,
  SessionState,
} from './types';

const KEY = {
  classifications: 'rtag:pref:classifications',
  exposures: 'rtag:pref:exposures',
  stats: 'rtag:pref:stats',
  muted: 'rtag:pref:muted',
  summary: 'rtag:pref:summary',
  session: 'rtag:pref:session',
  migrated: 'rtag:pref:legacyMigrated',
  userProfile: 'rtag:userProfile',
};

export type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
};

/** Demo “signed-in” identity until real auth exists. */
export const DEMO_USER_PROFILE: UserProfile = {
  firstName: 'Nebojsa',
  lastName: 'Kosijer',
  email: 'kosijer@test.com',
};

export const emptyUserProfile = (): UserProfile => ({ ...DEMO_USER_PROFILE });

function newSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getClassifications(): Promise<Record<string, PoiClassification>> {
  const raw = await AsyncStorage.getItem(KEY.classifications);
  return raw ? (JSON.parse(raw) as Record<string, PoiClassification>) : {};
}

export async function saveClassification(
  row: PoiClassification,
): Promise<void> {
  const all = await getClassifications();
  all[row.poiId] = row;
  await AsyncStorage.setItem(KEY.classifications, JSON.stringify(all));
}

export async function getExposures(): Promise<ExposureRecord[]> {
  const raw = await AsyncStorage.getItem(KEY.exposures);
  return raw ? (JSON.parse(raw) as ExposureRecord[]) : [];
}

export async function saveExposures(rows: ExposureRecord[]): Promise<void> {
  await AsyncStorage.setItem(
    KEY.exposures,
    JSON.stringify(rows.slice(-500)),
  );
}

export async function getCategoryStatsMap(): Promise<Record<string, CategoryStats>> {
  const raw = await AsyncStorage.getItem(KEY.stats);
  return raw ? (JSON.parse(raw) as Record<string, CategoryStats>) : {};
}

export async function saveCategoryStatsMap(
  stats: Record<string, CategoryStats>,
): Promise<void> {
  await AsyncStorage.setItem(KEY.stats, JSON.stringify(stats));
}

export async function getMutedCategories(): Promise<CategoryId[]> {
  const raw = await AsyncStorage.getItem(KEY.muted);
  return raw ? (JSON.parse(raw) as CategoryId[]) : [];
}

export async function setCategoryMuted(
  category: CategoryId,
  muted: boolean,
): Promise<CategoryId[]> {
  const current = await getMutedCategories();
  const next = muted
    ? [...new Set([...current, category])]
    : current.filter(c => c !== category);
  await AsyncStorage.setItem(KEY.muted, JSON.stringify(next));
  return next;
}

export async function getProfileSummary(): Promise<{
  text: string;
  generatedAt: number;
  basedOnExposures: number;
} | null> {
  const raw = await AsyncStorage.getItem(KEY.summary);
  return raw
    ? (JSON.parse(raw) as {
        text: string;
        generatedAt: number;
        basedOnExposures: number;
      })
    : null;
}

export async function saveProfileSummary(
  text: string,
  basedOnExposures: number,
): Promise<void> {
  await AsyncStorage.setItem(
    KEY.summary,
    JSON.stringify({
      text,
      generatedAt: Date.now(),
      basedOnExposures,
    }),
  );
}

export async function getPreferenceProfile(): Promise<PreferenceProfile> {
  const [stats, muted, summary] = await Promise.all([
    getCategoryStatsMap(),
    getMutedCategories(),
    getProfileSummary(),
  ]);
  return {
    stats,
    muted,
    summaryText: summary?.text,
    summaryGeneratedAt: summary?.generatedAt,
    summaryBasedOnExposures: summary?.basedOnExposures,
  };
}

export async function getSessionState(): Promise<SessionState> {
  const raw = await AsyncStorage.getItem(KEY.session);
  if (raw) {
    return JSON.parse(raw) as SessionState;
  }
  const fresh: SessionState = {
    mood: null,
    recentPrimaryCategories: [],
    selectionCount: 0,
    sessionId: newSessionId(),
  };
  await AsyncStorage.setItem(KEY.session, JSON.stringify(fresh));
  return fresh;
}

export async function setSessionMood(mood: SessionMood): Promise<SessionState> {
  const session = await getSessionState();
  const next = { ...session, mood };
  await AsyncStorage.setItem(KEY.session, JSON.stringify(next));
  return next;
}

export async function recordSelection(
  primary: CategoryId,
): Promise<SessionState> {
  const session = await getSessionState();
  const next: SessionState = {
    ...session,
    selectionCount: session.selectionCount + 1,
    recentPrimaryCategories: [
      ...session.recentPrimaryCategories,
      primary,
    ].slice(-12),
  };
  await AsyncStorage.setItem(KEY.session, JSON.stringify(next));
  return next;
}

export async function resetPreferenceProfile(): Promise<void> {
  await AsyncStorage.removeMany([KEY.stats, KEY.summary, KEY.muted]);
}

export async function getUserProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(KEY.userProfile);
  if (!raw) {
    await AsyncStorage.setItem(
      KEY.userProfile,
      JSON.stringify(DEMO_USER_PROFILE),
    );
    return { ...DEMO_USER_PROFILE };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    const firstName = parsed.firstName?.trim() ?? '';
    const lastName = parsed.lastName?.trim() ?? '';
    const email = parsed.email?.trim() ?? '';
    // Empty legacy row → seed demo identity so Profile looks signed-in.
    if (!firstName && !lastName && !email) {
      await AsyncStorage.setItem(
        KEY.userProfile,
        JSON.stringify(DEMO_USER_PROFILE),
      );
      return { ...DEMO_USER_PROFILE };
    }
    return { firstName, lastName, email };
  } catch {
    return { ...DEMO_USER_PROFILE };
  }
}

export async function saveUserProfile(
  profile: UserProfile,
): Promise<UserProfile> {
  await AsyncStorage.setItem(KEY.userProfile, JSON.stringify(profile));
  return profile;
}

export async function setCategoryInterest(
  category: CategoryId,
  interest0to100: number,
): Promise<CategoryStats> {
  const stats = await getCategoryStatsMap();
  const next = interestToStats(category, interest0to100, stats[category]);
  stats[category] = next;
  await saveCategoryStatsMap(stats);
  return next;
}

export async function recordExposure(input: {
  poiId: string;
  categories: CategoryId[];
  primaryCategory: CategoryId;
  context: ExposureRecord['context'];
  viable: boolean;
  blockedReason?: string;
}): Promise<ExposureRecord> {
  const session = await getSessionState();
  const row: ExposureRecord = {
    id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    poiId: input.poiId,
    sessionId: session.sessionId,
    suggestedAt: Date.now(),
    context: input.context,
    viable: input.viable,
    blockedReason: input.blockedReason,
    outcome: 'ignored',
    statsApplied: false,
    categories: input.categories,
    primaryCategory: input.primaryCategory,
  };
  const all = await getExposures();
  all.push(row);
  await saveExposures(all);
  await recordSelection(input.primaryCategory);
  return row;
}

export async function setExposureOutcome(
  exposureId: string,
  outcome: ExposureOutcome,
): Promise<ExposureRecord | null> {
  const all = await getExposures();
  const idx = all.findIndex(e => e.id === exposureId);
  if (idx < 0) {
    return null;
  }
  const stats = await getCategoryStatsMap();
  const { stats: nextStats, exposure } = applyExposureOutcome(
    stats,
    all[idx],
    outcome,
  );
  all[idx] = exposure;
  await saveExposures(all);
  await saveCategoryStatsMap(nextStats);
  return exposure;
}

export async function setNarrationQuality(
  exposureId: string,
  quality: 1 | 2 | 3 | 4 | 5 | null,
): Promise<void> {
  const all = await getExposures();
  const idx = all.findIndex(e => e.id === exposureId);
  if (idx < 0) {
    return;
  }
  const { narrationQuality: _n, ...rest } = all[idx];
  all[idx] = quality == null ? rest : { ...rest, narrationQuality: quality };
  await saveExposures(all);
}

export async function lastExposureForPoi(
  poiId: string,
): Promise<ExposureRecord | undefined> {
  const all = await getExposures();
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].poiId === poiId) {
      return all[i];
    }
  }
  return undefined;
}

export async function ensureStatsInitialized(): Promise<void> {
  const stats = await getCategoryStatsMap();
  if (Object.keys(stats).length > 0) {
    return;
  }
  const now = Date.now();
  const seeded: Record<string, CategoryStats> = {};
  for (const id of CATEGORY_IDS) {
    if (id === 'other') {
      continue;
    }
    seeded[id] = priorFor(id, now);
  }
  await saveCategoryStatsMap(seeded);
}

export async function isLegacyMigrated(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY.migrated)) === '1';
}

export async function markLegacyMigrated(): Promise<void> {
  await AsyncStorage.setItem(KEY.migrated, '1');
}

export { PREF };
