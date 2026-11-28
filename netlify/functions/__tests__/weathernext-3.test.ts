import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const axiosGet = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { get: axiosGet } }));

import { handler } from '../weathernext-3.ts';

/**
 * /api/weathernext-3: which key it spends, what it sends upstream, and what a
 * failure shows the caller. axios is mocked, so nothing touches the network.
 */

const KEY_VARS = ['GOOGLE_WEATHER_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_API_KEY', 'MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY'];
const saved: Record<string, string | undefined> = {};
let ipCounter = 0;

const call = (qs: Record<string, string>, headers: Record<string, string> = {}) =>
  handler(
    {
      httpMethod: 'GET',
      queryStringParameters: qs,
      headers: { 'x-nf-client-connection-ip': `198.51.100.${(++ipCounter % 250) + 1}`, ...headers },
    } as any,
    {} as any
  ) as Promise<{ statusCode: number; body: string }>;

const urlsCalled = () => axiosGet.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  for (const name of KEY_VARS) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  axiosGet.mockReset();
  axiosGet.mockRejectedValue(new Error('upstream down: secret-internal-detail'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const name of KEY_VARS) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  vi.restoreAllMocks();
});

describe('weathernext-3 handler', () => {
  it('rejects missing or out-of-range coordinates without calling upstream', async () => {
    for (const qs of [{}, { latitude: '23.8' }, { latitude: '95', longitude: '90' }, { latitude: 'x', longitude: '90' }]) {
      expect((await call(qs)).statusCode).toBe(400);
    }
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('never spends the browser-exposed VITE_ key, even when a caller sends it', async () => {
    process.env.VITE_GOOGLE_MAPS_API_KEY = 'browser-key';
    await call(
      { latitude: '23.81', longitude: '90.41', apiKey: 'caller-key' },
      { 'x-google-maps-key': 'caller-key' }
    );
    expect(urlsCalled().some((u) => u.includes('weather.googleapis.com'))).toBe(false);
    expect(JSON.stringify(axiosGet.mock.calls)).not.toMatch(/browser-key|caller-key/);
  });

  it('uses a server-side key, with snapped coordinates, for the Google calls', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'server-key';
    process.env.VITE_GOOGLE_MAPS_API_KEY = 'browser-key';
    await call({ latitude: '23.8123', longitude: '90.4177', timezone: 'x1', forecast_days: 'zzz' });
    const googleCalls = axiosGet.mock.calls.filter((c) => String(c[0]).includes('weather.googleapis.com'));
    expect(googleCalls.length).toBe(3);
    for (const [, options] of googleCalls) {
      expect(options.params.key).toBe('server-key');
      expect(options.params['location.latitude']).toBe(23.8);
      expect(options.params['location.longitude']).toBe(90.4);
    }
  });

  it('sends only an allowlisted timezone and forecast_days to Open-Meteo', async () => {
    await call({ latitude: '23.81', longitude: '90.41', timezone: 'x2%26past_days=9', forecast_days: '999' });
    const open = axiosGet.mock.calls.find((c) => String(c[0]).includes('open-meteo.com'));
    expect(open).toBeTruthy();
    expect(open![1].params.timezone).toBe('auto');
    expect(open![1].params.forecast_days).toBe(7);
  });

  it('does not leak the error message when generating the forecast fails', async () => {
    const res = await call({ latitude: '23.81', longitude: '90.41' });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body).not.toContain('secret-internal-detail');
    expect(res.body).not.toContain('details');
  });
});
