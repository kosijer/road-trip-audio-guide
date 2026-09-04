import { fetchJsonSilent } from './http';

export type WeatherSnapshot = {
  rainingNow: boolean;
  rainLikelyNextHour: boolean;
  caveat?: string;
};

export async function getWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}` +
    `&longitude=${longitude}&current=precipitation,rain` +
    `&hourly=precipitation_probability,precipitation&forecast_days=1`;
  const data = await fetchJsonSilent<{
    current?: { precipitation?: number; rain?: number };
    hourly?: { precipitation_probability?: number[]; precipitation?: number[] };
  }>(url);
  if (!data) {
    return null;
  }
  const rainingNow =
    (data.current?.precipitation ?? 0) > 0.1 || (data.current?.rain ?? 0) > 0.1;
  const nextProb = data.hourly?.precipitation_probability?.[0] ?? 0;
  const nextPrecip = data.hourly?.precipitation?.[0] ?? 0;
  const rainLikelyNextHour = nextProb >= 50 || nextPrecip > 0.2;
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
