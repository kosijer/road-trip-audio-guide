import {
  __resetWeatherCacheForTests,
  getCachedWeather,
  getWeather,
  isWeatherStale,
} from '../services/weather';
import { weatherBucket, weatherLabelKey } from '../services/weatherCodes';

jest.mock('../services/http', () => ({
  fetchJsonSilent: jest.fn(),
}));

jest.mock('../services/location', () => ({
  getRealLocation: jest.fn(),
}));

const { fetchJsonSilent } = jest.requireMock('../services/http') as {
  fetchJsonSilent: jest.Mock;
};

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    current: {
      time: '2026-10-30T23:15',
      temperature_2m: 12.4,
      weather_code: 3,
      precipitation: 0,
      rain: 0,
      ...(overrides.current as object),
    },
    hourly: {
      time: [
        '2026-10-30T22:00',
        '2026-10-30T23:00',
        '2026-10-31T00:00',
        '2026-10-31T01:00',
      ],
      temperature_2m: [13, 12, 11, 10],
      weather_code: [2, 3, 61, 61],
      precipitation_probability: [80, 10, 10, 20],
      precipitation: [1.2, 0, 0, 0],
      ...(overrides.hourly as object),
    },
  };
}

describe('getWeather', () => {
  beforeEach(() => {
    fetchJsonSilent.mockReset();
    __resetWeatherCacheForTests();
  });

  it('ignores dry conditions but still returns UI fields', async () => {
    fetchJsonSilent.mockResolvedValue(basePayload());
    const weather = await getWeather(51.5, -0.12);
    expect(weather?.caveat).toBeUndefined();
    expect(weather?.rainingNow).toBe(false);
    expect(weather?.current.temperatureC).toBe(12.4);
    expect(weather?.current.weatherCode).toBe(3);
    expect(weather?.hourly.length).toBeGreaterThan(0);
    expect(weather?.hourly[0].time).toBe('2026-10-30T23:00');
    expect(getCachedWeather()?.current.weatherCode).toBe(3);
  });

  it('does not treat midnight hour as "next hour"', async () => {
    fetchJsonSilent.mockResolvedValue(
      basePayload({
        hourly: {
          time: ['2026-10-30T00:00', '2026-10-30T23:00', '2026-10-31T00:00'],
          temperature_2m: [8, 12, 11],
          weather_code: [61, 3, 3],
          precipitation_probability: [90, 5, 5],
          precipitation: [2, 0, 0],
        },
      }),
    );
    const weather = await getWeather(51.5, -0.12);
    expect(weather?.caveat).toBeUndefined();
  });

  it('flags real rain now', async () => {
    fetchJsonSilent.mockResolvedValue(
      basePayload({
        current: {
          time: '2026-10-30T23:15',
          temperature_2m: 9,
          weather_code: 61,
          precipitation: 1.2,
          rain: 1.1,
        },
        hourly: {
          time: ['2026-10-30T23:00', '2026-10-31T00:00'],
          temperature_2m: [9, 8],
          weather_code: [61, 61],
          precipitation_probability: [90, 80],
          precipitation: [1.2, 0.8],
        },
      }),
    );
    const weather = await getWeather(51.5, -0.12);
    expect(weather?.rainingNow).toBe(true);
    expect(weather?.caveat).toMatch(/rain/i);
    expect(weather?.current.weatherCode).toBe(61);
  });

  it('requests expanded Open-Meteo fields', async () => {
    fetchJsonSilent.mockResolvedValue(basePayload());
    await getWeather(44.8, 20.4);
    const url = String(fetchJsonSilent.mock.calls[0][0]);
    expect(url).toContain('temperature_2m');
    expect(url).toContain('weather_code');
    expect(url).toContain('forecast_days=2');
  });

  it('marks missing cache as stale', () => {
    expect(isWeatherStale(null)).toBe(true);
  });
});

describe('weatherCodes', () => {
  it('maps WMO codes to buckets and labels', () => {
    expect(weatherBucket(0)).toBe('clear');
    expect(weatherBucket(2)).toBe('partlyCloudy');
    expect(weatherBucket(61)).toBe('rain');
    expect(weatherBucket(75)).toBe('snow');
    expect(weatherBucket(95)).toBe('thunder');
    expect(weatherLabelKey(0)).toBe('weatherClear');
    expect(weatherLabelKey(61)).toBe('weatherRain');
  });
});
