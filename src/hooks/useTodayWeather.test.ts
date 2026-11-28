import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.mock('../utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => fetchMock(...args),
  readJsonWithTimeout: async (response: { json: () => Promise<unknown> }) => response.json(),
}));

import { getTodayReading } from './useTodayWeather';

const feed = (temp: number) => ({ current: { temperature_2m: temp, time: '2026-11-29T10:00', relative_humidity_2m: 60 } });
const okResponse = (temp: number) => ({ ok: true, json: async () => feed(temp) });

let lat = 20;
beforeEach(() => {
  fetchMock.mockReset();
  // A new place each test: the reading cache lives for the whole module.
  lat += 1;
});

describe('getTodayReading', () => {
  it('gives the reading Home would show, with the time it was read', async () => {
    fetchMock.mockResolvedValue(okResponse(31));
    const reading = await getTodayReading({ latitude: lat, longitude: 90 });
    expect(reading?.weather.temp).toBe(31);
    expect(reading?.weather.humidity).toBe(60);
    expect(Number.isNaN(Date.parse(reading!.readingAt))).toBe(false);
  });

  it('reuses the cached reading and shares a request made at the same time', async () => {
    fetchMock.mockResolvedValue(okResponse(28));
    const place = { latitude: lat, longitude: 91 };
    const [a, b] = await Promise.all([getTodayReading(place), getTodayReading(place)]);
    await getTodayReading(place);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a?.readingAt).toBe(b?.readingAt);
  });

  it('gives null, never an error, when there is no place or the feed fails', async () => {
    expect(await getTodayReading(null)).toBeNull();
    expect(await getTodayReading({ latitude: NaN, longitude: 90 })).toBeNull();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await getTodayReading({ latitude: lat, longitude: 92 })).toBeNull();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await getTodayReading({ latitude: lat, longitude: 93 })).toBeNull();
  });
});
