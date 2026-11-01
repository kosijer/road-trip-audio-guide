import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';
import { cellId, haversineM } from '../geo';
import type { AppLanguage } from '../i18n/types';
import type {
  Poi,
  PrefetchBatch,
  PrefetchPlaceTarget,
  TripStatus,
  VisitRating,
  VisitRecord,
} from '../types';
import { PREFETCH_PLACE_OPTIONS } from '../types';

const VISIT_DEDUP_METERS = 200;

function normalizeVisitTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sameVisitPlace(
  a: Pick<VisitRecord, 'poiId' | 'title' | 'latitude' | 'longitude'>,
  b: Pick<VisitRecord, 'poiId' | 'title' | 'latitude' | 'longitude'>,
): boolean {
  if (a.poiId === b.poiId) {
    return true;
  }
  if (normalizeVisitTitle(a.title) !== normalizeVisitTitle(b.title)) {
    return false;
  }
  return (
    haversineM(
      { latitude: a.latitude, longitude: a.longitude },
      { latitude: b.latitude, longitude: b.longitude },
    ) <= VISIT_DEDUP_METERS
  );
}

/** Keep newest / rated visit when the same place appears more than once. */
export function dedupeVisits(visits: VisitRecord[]): VisitRecord[] {
  const kept: VisitRecord[] = [];
  for (const visit of visits) {
    const idx = kept.findIndex(existing => sameVisitPlace(existing, visit));
    if (idx < 0) {
      kept.push(visit);
      continue;
    }
    const existing = kept[idx];
    const preferVisit =
      (visit.rating != null && existing.rating == null) ||
      visit.narratedAt >= existing.narratedAt;
    if (preferVisit) {
      kept[idx] = {
        ...visit,
        rating: visit.rating ?? existing.rating,
        ratedAt: visit.ratedAt ?? existing.ratedAt,
        summary: visit.summary || existing.summary,
        narrationExcerpt: visit.narrationExcerpt || existing.narrationExcerpt,
      };
    } else if (existing.rating == null && visit.rating != null) {
      kept[idx] = {
        ...existing,
        rating: visit.rating,
        ratedAt: visit.ratedAt,
      };
    }
  }
  return kept.sort((a, b) => b.narratedAt - a.narratedAt);
}

const KEY = {
  poi: (id: string) => `rtag:poi:${id}`,
  cell: (id: string) => `rtag:cell:${id}`,
  narration: (id: string) => `rtag:narration:${id}`,
  narrated: 'rtag:narrated',
  status: 'rtag:status',
  llmCalls: 'rtag:llmCalls',
  speechPace: 'rtag:speechPace',
  speechRate: 'rtag:speechRate',
  uiLanguage: 'rtag:uiLanguage',
  narrationLanguage: 'rtag:narrationLanguage',
  narrationFollowsUi: 'rtag:narrationFollowsUi',
  visits: 'rtag:visits',
  prefetchBatch: 'rtag:prefetchBatch',
  prefetchSampleTarget: 'rtag:prefetchSampleTarget',
  speedThresholdKmh: 'rtag:speedThresholdKmh',
  speechMuted: 'rtag:speechMuted',
};

export const PREFETCH_PLACE_DEFAULT: PrefetchPlaceTarget = 12;

const MAX_VISITS = 200;

export const SPEECH_RATE_MIN = 0.5;
export const SPEECH_RATE_MAX = 1.5;
export const SPEECH_RATE_STEP = 0.05;
export const SPEECH_RATE_DEFAULT = 1.0;

export const SPEED_THRESHOLD_MIN_KMH = 3;
export const SPEED_THRESHOLD_MAX_KMH = 40;
export const SPEED_THRESHOLD_STEP_KMH = 1;
export const SPEED_THRESHOLD_DEFAULT_KMH = 25;
/** Below this, also require displacement across recent samples (GPS jitter). */
export const SPEED_MOVE_GATE_KMH = 10;
export const SPEED_MIN_DISPLACEMENT_M = 25;

function clampSpeechRate(value: number): number {
  const clamped = Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, value));
  return Math.round(clamped / SPEECH_RATE_STEP) * SPEECH_RATE_STEP;
}

export function clampSpeedThresholdKmh(value: number): number {
  const clamped = Math.min(
    SPEED_THRESHOLD_MAX_KMH,
    Math.max(SPEED_THRESHOLD_MIN_KMH, value),
  );
  return Math.round(clamped / SPEED_THRESHOLD_STEP_KMH) * SPEED_THRESHOLD_STEP_KMH;
}

function parseLanguage(raw: string | null): AppLanguage | null {
  if (raw === 'en' || raw === 'sr') {
    return raw;
  }
  return null;
}

export const emptyStatus = (): TripStatus => ({
  tripActive: false,
  moving: false,
  llmCalls: 0,
  message: '',
  prefetchCount: 0,
});

export async function savePoi(poi: Poi): Promise<void> {
  await AsyncStorage.setItem(KEY.poi(poi.id), JSON.stringify(poi));
  const cell = cellId(poi.location);
  const existing = await getCellPoiIds(cell);
  if (!existing.includes(poi.id)) {
    await AsyncStorage.setItem(KEY.cell(cell), JSON.stringify([...existing, poi.id]));
  }
}

export async function savePois(pois: Poi[]): Promise<void> {
  for (const poi of pois) {
    await savePoi(poi);
  }
}

export async function getPoi(id: string): Promise<Poi | null> {
  const raw = await AsyncStorage.getItem(KEY.poi(id));
  return raw ? (JSON.parse(raw) as Poi) : null;
}

export async function getCellPoiIds(id: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY.cell(id));
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function getCachedPoisNear(
  lat: number,
  lon: number,
  radiusM: number,
): Promise<Poi[]> {
  const center = { latitude: lat, longitude: lon };
  const ids = new Set<string>();
  const originCell = cellId(center);
  const [latI, lonI] = originCell.split(':').map(Number);
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const nearby = await getCellPoiIds(`${latI + dLat}:${lonI + dLon}`);
      nearby.forEach(id => ids.add(id));
    }
  }
  const pois: Poi[] = [];
  for (const id of ids) {
    const poi = await getPoi(id);
    if (!poi) {
      continue;
    }
    const distanceM = haversineM(center, poi.location);
    if (distanceM <= radiusM) {
      pois.push({ ...poi, distanceM });
    }
  }
  return pois;
}

export async function getNarration(id: string): Promise<string | null> {
  return AsyncStorage.getItem(KEY.narration(id));
}

export async function saveNarration(id: string, text: string): Promise<void> {
  await AsyncStorage.setItem(KEY.narration(id), text);
}

export type NarratedEntry = { id: string; at: number };

export type ParsedNarrated = {
  entries: NarratedEntry[];
  legacy: boolean;
};

/** Accept legacy string[] or timed entries. Legacy ids are stamped "now". */
export function parseNarratedEntries(
  raw: string | null,
  now = Date.now(),
): ParsedNarrated {
  if (!raw) {
    return { entries: [], legacy: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], legacy: false };
  }
  if (!Array.isArray(parsed)) {
    return { entries: [], legacy: false };
  }
  if (parsed.length > 0 && parsed.every(item => typeof item === 'string')) {
    return {
      entries: (parsed as string[]).map(id => ({ id, at: now })),
      legacy: true,
    };
  }
  const out: NarratedEntry[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as NarratedEntry).id === 'string' &&
      typeof (item as NarratedEntry).at === 'number'
    ) {
      out.push({
        id: (item as NarratedEntry).id,
        at: (item as NarratedEntry).at,
      });
    }
  }
  return { entries: out, legacy: false };
}

export function recentNarratedIds(
  entries: NarratedEntry[],
  cooldownMs: number,
  now = Date.now(),
): string[] {
  return entries.filter(e => now - e.at < cooldownMs).map(e => e.id);
}

async function readNarratedEntries(): Promise<NarratedEntry[]> {
  const raw = await AsyncStorage.getItem(KEY.narrated);
  const { entries, legacy } = parseNarratedEntries(raw);
  if (legacy) {
    await AsyncStorage.setItem(KEY.narrated, JSON.stringify(entries));
  }
  return entries;
}

export async function getNarratedIds(
  cooldownMs: number = config.narratedCooldownMs,
  now = Date.now(),
): Promise<string[]> {
  return recentNarratedIds(await readNarratedEntries(), cooldownMs, now);
}

export async function markNarrated(id: string, at = Date.now()): Promise<void> {
  const entries = await readNarratedEntries();
  const keepWindow = config.narratedCooldownMs * 2;
  const next = entries.filter(e => e.id !== id && at - e.at < keepWindow);
  next.push({ id, at });
  await AsyncStorage.setItem(KEY.narrated, JSON.stringify(next));
}

export async function resetTripMemory(): Promise<void> {
  // AsyncStorage v3 replaced multiRemove with removeMany.
  await AsyncStorage.removeMany([KEY.narrated, KEY.llmCalls]);
}

export async function getLlmCalls(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY.llmCalls);
  return raw ? Number(raw) || 0 : 0;
}

/** @deprecated kept for migration from Slow/Normal/Fast buttons */
export type SpeechPace = 'slow' | 'normal' | 'fast';

const PACE_TO_RATE: Record<SpeechPace, number> = {
  slow: 0.85,
  normal: 1.0,
  fast: 1.25,
};

export async function getSpeechRate(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY.speechRate);
  if (raw != null && raw !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return clampSpeechRate(parsed);
    }
  }
  const legacy = await AsyncStorage.getItem(KEY.speechPace);
  if (legacy === 'slow' || legacy === 'normal' || legacy === 'fast') {
    const migrated = PACE_TO_RATE[legacy];
    await AsyncStorage.setItem(KEY.speechRate, String(migrated));
    return migrated;
  }
  return SPEECH_RATE_DEFAULT;
}

export async function getSpeechMuted(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY.speechMuted);
  return raw === '1' || raw === 'true';
}

export async function saveSpeechMuted(muted: boolean): Promise<boolean> {
  await AsyncStorage.setItem(KEY.speechMuted, muted ? '1' : '0');
  return muted;
}

export async function getSpeedThresholdKmh(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY.speedThresholdKmh);
  if (raw != null && raw !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return clampSpeedThresholdKmh(parsed);
    }
  }
  return SPEED_THRESHOLD_DEFAULT_KMH;
}

export async function saveSpeedThresholdKmh(kmh: number): Promise<number> {
  const next = clampSpeedThresholdKmh(kmh);
  await AsyncStorage.setItem(KEY.speedThresholdKmh, String(next));
  return next;
}

export async function saveSpeechRate(rate: number): Promise<number> {
  const next = clampSpeechRate(rate);
  await AsyncStorage.setItem(KEY.speechRate, String(next));
  return next;
}

export type LanguageSettings = {
  uiLanguage: AppLanguage;
  narrationLanguage: AppLanguage;
  narrationFollowsUi: boolean;
};

export async function getLanguageSettings(): Promise<LanguageSettings> {
  const [uiRaw, narrRaw, followRaw] = await Promise.all([
    AsyncStorage.getItem(KEY.uiLanguage),
    AsyncStorage.getItem(KEY.narrationLanguage),
    AsyncStorage.getItem(KEY.narrationFollowsUi),
  ]);
  const uiLanguage = parseLanguage(uiRaw) ?? 'en';
  const narrationFollowsUi =
    followRaw == null ? true : followRaw === '1' || followRaw === 'true';
  const narrationLanguage = narrationFollowsUi
    ? uiLanguage
    : parseLanguage(narrRaw) ?? uiLanguage;
  return { uiLanguage, narrationLanguage, narrationFollowsUi };
}

export async function saveUiLanguage(lang: AppLanguage): Promise<LanguageSettings> {
  const current = await getLanguageSettings();
  await AsyncStorage.setItem(KEY.uiLanguage, lang);
  if (current.narrationFollowsUi) {
    await AsyncStorage.setItem(KEY.narrationLanguage, lang);
    return {
      uiLanguage: lang,
      narrationLanguage: lang,
      narrationFollowsUi: true,
    };
  }
  return {
    uiLanguage: lang,
    narrationLanguage: current.narrationLanguage,
    narrationFollowsUi: false,
  };
}

export async function saveNarrationLanguage(input: {
  language: AppLanguage;
  followsUi: boolean;
}): Promise<LanguageSettings> {
  const ui = (await getLanguageSettings()).uiLanguage;
  await AsyncStorage.setItem(
    KEY.narrationFollowsUi,
    input.followsUi ? 'true' : 'false',
  );
  const narrationLanguage = input.followsUi ? ui : input.language;
  await AsyncStorage.setItem(KEY.narrationLanguage, narrationLanguage);
  return {
    uiLanguage: ui,
    narrationLanguage,
    narrationFollowsUi: input.followsUi,
  };
}

export async function incrementLlmCalls(): Promise<number> {
  const next = (await getLlmCalls()) + 1;
  await AsyncStorage.setItem(KEY.llmCalls, String(next));
  return next;
}

export async function getStatus(): Promise<TripStatus> {
  const raw = await AsyncStorage.getItem(KEY.status);
  return raw ? ({ ...emptyStatus(), ...(JSON.parse(raw) as TripStatus) }) : emptyStatus();
}

export async function setStatus(patch: Partial<TripStatus>): Promise<TripStatus> {
  const current = await getStatus();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(KEY.status, JSON.stringify(next));
  return next;
}

export async function getVisitHistory(): Promise<VisitRecord[]> {
  const raw = await AsyncStorage.getItem(KEY.visits);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as VisitRecord[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    const deduped = dedupeVisits(parsed);
    if (deduped.length !== parsed.length) {
      await saveVisitHistory(deduped);
    }
    return deduped;
  } catch {
    return [];
  }
}

async function saveVisitHistory(visits: VisitRecord[]): Promise<void> {
  const clean = dedupeVisits(visits).slice(0, MAX_VISITS);
  await AsyncStorage.setItem(KEY.visits, JSON.stringify(clean));
}

export async function recordVisit(
  input: Omit<VisitRecord, 'id' | 'narratedAt' | 'rating' | 'ratedAt'>,
): Promise<VisitRecord> {
  const visits = await getVisitHistory();
  const existing = visits.find(v => sameVisitPlace(v, input));
  if (existing) {
    const updated: VisitRecord = {
      ...existing,
      ...input,
      id: existing.id,
      narratedAt: Date.now(),
      rating: existing.rating,
      ratedAt: existing.ratedAt,
    };
    const next = [updated, ...visits.filter(v => v.id !== existing.id)];
    await saveVisitHistory(next);
    return updated;
  }
  const created: VisitRecord = {
    ...input,
    id: `${input.poiId}:${Date.now()}`,
    narratedAt: Date.now(),
  };
  await saveVisitHistory([created, ...visits]);
  return created;
}

export async function setVisitRating(
  visitId: string,
  rating: VisitRating | null,
): Promise<VisitRecord[]> {
  const visits = await getVisitHistory();
  const next = visits.map(visit => {
    if (visit.id !== visitId) {
      return visit;
    }
    if (rating == null) {
      const { rating: _r, ratedAt: _a, ...rest } = visit;
      return rest;
    }
    return { ...visit, rating, ratedAt: Date.now() };
  });
  await saveVisitHistory(next);
  return next;
}

export async function getPrefetchPlaceTarget(): Promise<PrefetchPlaceTarget> {
  const raw = await AsyncStorage.getItem(KEY.prefetchSampleTarget);
  const n = Number(raw);
  if ((PREFETCH_PLACE_OPTIONS as readonly number[]).includes(n)) {
    return n as PrefetchPlaceTarget;
  }
  return PREFETCH_PLACE_DEFAULT;
}

export async function savePrefetchPlaceTarget(
  target: PrefetchPlaceTarget,
): Promise<void> {
  await AsyncStorage.setItem(KEY.prefetchSampleTarget, String(target));
}

/** @deprecated use getPrefetchPlaceTarget */
export const getPrefetchSampleTarget = getPrefetchPlaceTarget;
/** @deprecated use savePrefetchPlaceTarget */
export const savePrefetchSampleTarget = savePrefetchPlaceTarget;

export async function getPrefetchBatch(): Promise<PrefetchBatch | null> {
  const raw = await AsyncStorage.getItem(KEY.prefetchBatch);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PrefetchBatch & {
      sampleTarget?: number;
    };
    if (parsed.placeTarget == null && parsed.sampleTarget != null) {
      parsed.placeTarget = parsed.sampleTarget;
    }
    if (!Array.isArray(parsed.pois)) {
      return null;
    }
    parsed.pois = parsed.pois.map(poi => ({
      ...poi,
      category:
        poi.category && !/^Q\d+$/i.test(poi.category)
          ? poi.category
          : undefined,
    }));
    return parsed;
  } catch {
    return null;
  }
}

export async function savePrefetchBatch(batch: PrefetchBatch): Promise<void> {
  await AsyncStorage.setItem(KEY.prefetchBatch, JSON.stringify(batch));
}

export async function clearPrefetchBatch(): Promise<void> {
  await AsyncStorage.removeItem(KEY.prefetchBatch);
}

export async function clearVisitHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY.visits);
}

/** Progress / ranking strings that should not survive app relaunch. */
export function isTransientStatusMessage(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (!m) {
    return false;
  }
  return (
    m.includes('scanning route') ||
    m.includes('picking the top') ||
    m.includes('downloading') ||
    m.includes('skeniram rutu') ||
    m.includes('biram najboljih') ||
    m.includes('preuzimam') ||
    m.includes('looking for interesting') ||
    m.includes('looking for the next') ||
    m.includes('tražim') ||
    m === 'moving' ||
    m === 'stopped / slow traffic' ||
    m === 'u pokretu' ||
    m === 'stajanje / spor saobraćaj'
  );
}

/**
 * Cold start: drop ephemeral session UI (latest place, map pins, stale GPS,
 * route prefetch). Preferences / history / mute settings stay.
 */
export async function resetSessionOnLaunch(): Promise<TripStatus> {
  await clearPrefetchBatch();
  const next = emptyStatus();
  await AsyncStorage.setItem(KEY.status, JSON.stringify(next));
  return next;
}

/** @deprecated use resetSessionOnLaunch — kept for older call sites/tests. */
export async function sanitizeStatusOnLaunch(): Promise<TripStatus> {
  return resetSessionOnLaunch();
}
