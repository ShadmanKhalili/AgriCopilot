import { beforeEach, describe, expect, it, vi } from 'vitest';

const safeFetchMock = vi.fn();

vi.mock('./safe-url.ts', () => ({
  safeFetch: (...args: unknown[]) => safeFetchMock(...args),
  readTextWithLimit: async () => '<html>bulletin</html>',
}));

vi.mock('./market-prices.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./market-prices.ts')>();
  return {
    ...original,
    parseBulletin: () => [{ name: 'পেঁয়াজ - দেশী', low: 50, high: 60, changePct: 0, direction: 'flat' }],
  };
});

import {
  getFreshMarketBulletin,
  getStaleMarketBulletin,
  refreshMarketBulletinInBackground,
  rememberMarketBulletin,
  resetMarketBulletinCacheForTests,
  type BulletinPayload,
} from './market-bulletin.ts';

const oldPayload = (): BulletinPayload => ({
  source: 'test',
  sourceUrl: 'https://example.test',
  fetchedAt: '2020-01-01T00:00:00.000Z',
  stale: false,
  items: [],
  matched: [],
  missing: [],
  itemCount: 0,
});

describe('refreshMarketBulletinInBackground', () => {
  beforeEach(() => {
    resetMarketBulletinCacheForTests();
    safeFetchMock.mockReset();
    vi.useRealTimers();
  });

  it('stores the refreshed bulletin so the next request is served fresh', async () => {
    // An old copy, past the one-hour window but inside the 24-hour stale window.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-28T00:00:00Z'));
    rememberMarketBulletin(oldPayload());
    vi.setSystemTime(new Date('2026-11-28T03:00:00Z'));

    expect(getFreshMarketBulletin()).toBeNull();
    expect(getStaleMarketBulletin()?.fetchedAt).toBe('2020-01-01T00:00:00.000Z');

    safeFetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
    refreshMarketBulletinInBackground();
    await vi.waitFor(() => expect(getFreshMarketBulletin()).not.toBeNull());

    const fresh = getFreshMarketBulletin();
    expect(fresh?.fetchedAt).not.toBe('2020-01-01T00:00:00.000Z');
    expect(fresh?.itemCount).toBe(1);
    expect(fresh?.stale).toBe(false);
  });

  it('does not start a second fetch while one refresh is running', async () => {
    let release: (r: Response) => void = () => {};
    safeFetchMock.mockImplementation(() => new Promise<Response>((resolve) => { release = resolve; }));

    refreshMarketBulletinInBackground();
    refreshMarketBulletinInBackground();
    refreshMarketBulletinInBackground();
    await vi.waitFor(() => expect(safeFetchMock).toHaveBeenCalledTimes(1));

    release(new Response('ok', { status: 200 }));
    await vi.waitFor(() => expect(getFreshMarketBulletin()).not.toBeNull());
    expect(safeFetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the old copy when the refresh fails, and can try again later', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-28T00:00:00Z'));
    rememberMarketBulletin(oldPayload());
    vi.setSystemTime(new Date('2026-11-28T03:00:00Z'));

    safeFetchMock.mockResolvedValue(new Response('down', { status: 503 }));
    refreshMarketBulletinInBackground();
    // Two attempts (retry has a 700 ms real pause).
    await vi.waitFor(() => expect(safeFetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(getStaleMarketBulletin()?.fetchedAt).toBe('2020-01-01T00:00:00.000Z');

    safeFetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
    refreshMarketBulletinInBackground();
    await vi.waitFor(() => expect(getFreshMarketBulletin()).not.toBeNull());
  });
});
