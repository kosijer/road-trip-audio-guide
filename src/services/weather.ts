import { DeviceEventEmitter } from 'react-native';
import { tn } from '../i18n';
import { fetchJsonSilent } from './http';
import { getRealLocation } from './location';

export const WEATHER_EVENT = 'rtag-weather';
export const WEATHER_STALE_MS = 45 * 60 * 1000;
const HOURLY_COUNT = 12;

export type WeatherHour = {
  time: string;
  temperatureC: number;
  weatherCode: number;
  precipProbability: number;
};

export type WeatherCurrent = {
  temperatureC: number;
  weatherCode: number;
};

export type WeatherSnapshot = {
  rainingNow: boolean;
  rainLikelyNextHour: boolean;
  caveat?: string;
  fetchedAt: number;
  latitude: number;
  longitude: number;
  current: WeatherCurrent;
  hourly: WeatherHour[];
};

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    precipitation?: number;
    rain?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
  };
};

let cached: WeatherSnapshot | null = null;

export function getCachedWeather(): WeatherSnapshot | null {
  return cached;
}

export function isWeatherStale(
  snapshot: WeatherSnapshot | null = cached,
  now = Date.now(),
): boolean {
  if (!snapshot) {
    return true;
  }
  return now - snapshot.fetchedAt >= WEATHER_STALE_MS;
}

function emitWeather(snapshot: WeatherSnapshot | null) {
  DeviceEventEmitter.emit(WEATHER_EVENT, { weather: snapshot });
}

function setCache(snapshot: WeatherSnapshot) {
  cached = snapshot;
  emitWeather(snapshot);
}

function hourIndex(times: string[] | undefined, currentTime?: string): number {
  if (!times?.length) {
    return 0;
  }
  if (!currentTime) {
    return 0;
  }
  // Open-Meteo current is like 2026-10-30T23:15; hourly buckets are on the hour.
  const prefix = currentTime.slice(0, 13); // YYYY-MM-DDTHH
  const exact = times.findIndex(t => t.startsWith(prefix));
  if (exact >= 0) {
    return exact;
  }
  // Fall back to the last hour that is not in the future relative to current.
  let best = 0;
  for (let i = 0; i < times.length; i++) {
    if (times[i] <= currentTime) {
      best = i;
    }
  }
  return best;
}

function buildHourly(
  hourly: OpenMeteoResponse['hourly'],
  startIdx: number,
): WeatherHour[] {
  const times = hourly?.time ?? [];
  const temps = hourly?.temperature_2m ?? [];
  const codes = hourly?.weather_code ?? [];
  const probs = hourly?.precipitation_probability ?? [];
  const out: WeatherHour[] = [];
  for (let i = startIdx; i < times.length && out.length < HOURLY_COUNT; i++) {
    out.push({
      time: times[i],
      temperatureC: temps[i] ?? 0,
      weatherCode: codes[i] ?? 0,
      precipProbability: probs[i] ?? 0,
    });
  }
  return out;
}

export async function getWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot | null> {
  // forecast_days=2 so late-evening users still get ~12 hours ahead.
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&current=temperature_2m,weather_code,precipitation,rain` +
    `&hourly=temperature_2m,weather_code,precipitation_probability,precipitation` +
    `&forecast_days=2&timezone=auto`;
  const data = await fetchJsonSilent<OpenMeteoResponse>(url);
  if (!data) {
    return null;
  }

  // Require meaningful precipitation — ignore drizzle noise / sensor dust.
  const rainingNow =
    (data.current?.precipitation ?? 0) >= 0.5 ||
    (data.current?.rain ?? 0) >= 0.5;

  const idx = hourIndex(data.hourly?.time, data.current?.time);
  const nextIdx = Math.min(
    idx + 1,
    (data.hourly?.precipitation_probability?.length ?? 1) - 1,
  );
  const nextProb = data.hourly?.precipitation_probability?.[nextIdx] ?? 0;
  const nextPrecip = data.hourly?.precipitation?.[nextIdx] ?? 0;
  // Need both a solid probability and some expected precip — 50% alone was too chatty.
  const rainLikelyNextHour = nextProb >= 70 && nextPrecip >= 0.5;

  const currentCode = data.current?.weather_code ?? data.hourly?.weather_code?.[idx] ?? 0;
  const currentTemp =
    data.current?.temperature_2m ?? data.hourly?.temperature_2m?.[idx] ?? 0;

  const snapshot: WeatherSnapshot = {
    rainingNow,
    rainLikelyNextHour,
    fetchedAt: Date.now(),
    latitude,
    longitude,
    current: {
      temperatureC: currentTemp,
      weatherCode: currentCode,
    },
    hourly: buildHourly(data.hourly, idx),
  };
  if (rainingNow || rainLikelyNextHour) {
    snapshot.caveat = rainingNow
      ? tn('weatherRainingNow')
      : tn('weatherRainLikely');
  }

  setCache(snapshot);
  return snapshot;
}

/** Refresh using real GPS (ignores debug POI presets). */
export async function refreshWeatherFromDevice(): Promise<WeatherSnapshot | null> {
  try {
    const loc = await getRealLocation();
    return await getWeather(loc.latitude, loc.longitude);
  } catch {
    return null;
  }
}

/** Test helper — clears in-memory cache between cases. */
export function __resetWeatherCacheForTests() {
  cached = null;
}
