import { getWeather } from '../services/weather';

jest.mock('../services/http', () => ({
  fetchJsonSilent: jest.fn(),
}));

const { fetchJsonSilent } = jest.requireMock('../services/http') as {
  fetchJsonSilent: jest.Mock;
};

describe('getWeather', () => {
  beforeEach(() => {
    fetchJsonSilent.mockReset();
  });

  it('ignores dry conditions', async () => {
    fetchJsonSilent.mockResolvedValue({
      current: {
        time: '2026-10-30T23:15',
        precipitation: 0,
        rain: 0,
      },
      hourly: {
        time: ['2026-10-30T22:00', '2026-10-30T23:00', '2026-10-31T00:00'],
        precipitation_probability: [80, 10, 10],
        precipitation: [1.2, 0, 0],
      },
    });
    const weather = await getWeather(51.5, -0.12);
    expect(weather?.caveat).toBeUndefined();
    expect(weather?.rainingNow).toBe(false);
  });

  it('does not treat midnight hour as "next hour"', async () => {
    fetchJsonSilent.mockResolvedValue({
      current: {
        time: '2026-10-30T23:15',
        precipitation: 0,
        rain: 0,
      },
      hourly: {
        time: ['2026-10-30T00:00', '2026-10-30T23:00', '2026-10-31T00:00'],
        precipitation_probability: [90, 5, 5],
        precipitation: [2, 0, 0],
      },
    });
    const weather = await getWeather(51.5, -0.12);
    expect(weather?.caveat).toBeUndefined();
  });

  it('flags real rain now', async () => {
    fetchJsonSilent.mockResolvedValue({
      current: {
        time: '2026-10-30T23:15',
        precipitation: 1.2,
        rain: 1.1,
      },
      hourly: {
        time: ['2026-10-30T23:00', '2026-10-31T00:00'],
        precipitation_probability: [90, 80],
        precipitation: [1.2, 0.8],
      },
    });
    const weather = await getWeather(51.5, -0.12);
    expect(weather?.rainingNow).toBe(true);
    expect(weather?.caveat).toMatch(/kiša/i);
  });
});
