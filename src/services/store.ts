import AsyncStorage from '@react-native-async-storage/async-storage';
import { cellId, haversineM } from '../geo';
import type { AppLanguage } from '../i18n/types';
import type { Poi, TripStatus } from '../types';

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
};

export const SPEECH_RATE_MIN = 0.5;
export const SPEECH_RATE_MAX = 1.5;
export const SPEECH_RATE_STEP = 0.05;
export const SPEECH_RATE_DEFAULT = 1.0;

function clampSpeechRate(value: number): number {
  const clamped = Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, value));
  return Math.round(clamped / SPEECH_RATE_STEP) * SPEECH_RATE_STEP;
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

export async function getNarratedIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY.narrated);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function markNarrated(id: string): Promise<void> {
  const ids = await getNarratedIds();
  if (!ids.includes(id)) {
    await AsyncStorage.setItem(KEY.narrated, JSON.stringify([...ids, id]));
  }
}

export async function resetTripMemory(): Promise<void> {
  await AsyncStorage.multiRemove([KEY.narrated, KEY.llmCalls]);
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
