import type { StringKey } from '../i18n/types';

/** Coarse buckets for Lucide icons + short i18n labels. */
export type WeatherBucket =
  | 'clear'
  | 'mostlyClear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunder'
  | 'unknown';

export function weatherBucket(code: number | undefined | null): WeatherBucket {
  if (code == null || Number.isNaN(code)) {
    return 'unknown';
  }
  if (code === 0) {
    return 'clear';
  }
  if (code === 1) {
    return 'mostlyClear';
  }
  if (code === 2) {
    return 'partlyCloudy';
  }
  if (code === 3) {
    return 'overcast';
  }
  if (code === 45 || code === 48) {
    return 'fog';
  }
  if (code >= 51 && code <= 57) {
    return 'drizzle';
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return 'rain';
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return 'snow';
  }
  if (code >= 95 && code <= 99) {
    return 'thunder';
  }
  return 'unknown';
}

export function weatherLabelKey(code: number | undefined | null): StringKey {
  switch (weatherBucket(code)) {
    case 'clear':
      return 'weatherClear';
    case 'mostlyClear':
      return 'weatherMostlyClear';
    case 'partlyCloudy':
      return 'weatherPartlyCloudy';
    case 'overcast':
      return 'weatherOvercast';
    case 'fog':
      return 'weatherFog';
    case 'drizzle':
      return 'weatherDrizzle';
    case 'rain':
      return 'weatherRain';
    case 'snow':
      return 'weatherSnow';
    case 'thunder':
      return 'weatherThunder';
    default:
      return 'weatherUnknown';
  }
}
