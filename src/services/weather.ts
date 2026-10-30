import { fetchJsonSilent } from './http';

export type WeatherSnapshot = {
  rainingNow: boolean;
  rainLikelyNextHour: boolean;
  caveat?: string;
};

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

export async function getWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}` +
    `&longitude=${longitude}&current=precipitation,rain` +
    `&hourly=precipitation_probability,precipitation&forecast_days=1&timezone=auto`;
  const data = await fetchJsonSilent<{
    current?: { time?: string; precipitation?: number; rain?: number };
    hourly?: {
      time?: string[];
      precipitation_probability?: number[];
      precipitation?: number[];
    };
  }>(url);
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

  if (!rainingNow && !rainLikelyNextHour) {
    return { rainingNow: false, rainLikelyNextHour: false };
  }
  return {
    rainingNow,
    rainLikelyNextHour,
    caveat: rainingNow
      ? 'Trenutno pada kiša, pa otvoreni lokaliteti možda nisu prijatni.'
      : 'U narednom satu je verovatna kiša.',
  };
}
