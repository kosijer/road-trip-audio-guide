import type { Daypart, ExposureContext, PreferenceMode, Season } from './types';

export function daypartForHour(hour: number): Daypart {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'afternoon';
  }
  if (hour >= 17 && hour < 21) {
    return 'evening';
  }
  return 'night';
}

export function seasonForMonth(month: number): Season {
  if (month === 11 || month <= 1) {
    return 'winter';
  }
  if (month >= 2 && month <= 4) {
    return 'spring';
  }
  if (month >= 5 && month <= 7) {
    return 'summer';
  }
  return 'autumn';
}

export function buildExposureContext(
  mode: PreferenceMode,
  opts?: { weatherOk?: boolean | null; now?: Date },
): ExposureContext {
  const now = opts?.now ?? new Date();
  return {
    daypart: daypartForHour(now.getHours()),
    weekday: now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    season: seasonForMonth(now.getMonth()),
    weatherOk: opts?.weatherOk ?? null,
    mode,
    timeBudgetMin: null,
  };
}

export function isNightlifeViable(daypart: Daypart): boolean {
  return daypart === 'evening' || daypart === 'night';
}
