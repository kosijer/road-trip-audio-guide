import AsyncStorage from '@react-native-async-storage/async-storage';
import { cellId, haversineM } from '../geo';
import type { Poi, TripStatus } from '../types';

const KEY = {
  poi: (id: string) => `rtag:poi:${id}`,
  cell: (id: string) => `rtag:cell:${id}`,
  narration: (id: string) => `rtag:narration:${id}`,
  narrated: 'rtag:narrated',
  status: 'rtag:status',
  llmCalls: 'rtag:llmCalls',
};

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
