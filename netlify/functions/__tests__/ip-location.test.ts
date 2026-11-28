import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../ip-location.ts';

const call = (headers: Record<string, string>) =>
  (handler as any)({ headers, httpMethod: 'GET' }, {}) as Promise<{ statusCode: number; body: string }>;

const geo = (latitude: string, longitude: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ latitude, longitude, city: 'X', region: 'Y', country: 'Z', country_code: 'ZZ' }),
});

describe('ip-location function', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('geolocates the client IP from the Netlify header, not the server', async () => {
    fetchMock.mockResolvedValue(geo('23.7', '90.4'));
    const res = await call({ 'x-nf-client-connection-ip': '103.4.5.6', 'x-forwarded-for': '8.8.8.8' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://get.geojs.io/v1/ip/geo/103.4.5.6.json');
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body).toMatchObject({ latitude: 23.7, longitude: 90.4, isWithinBangladesh: true });
  });

  it('falls back to the first x-forwarded-for entry', async () => {
    fetchMock.mockResolvedValue(geo('23.7', '90.4'));
    await call({ 'X-Forwarded-For': '103.4.5.6, 10.0.0.1' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://get.geojs.io/v1/ip/geo/103.4.5.6.json');
  });

  it('accepts an IPv6 literal', async () => {
    fetchMock.mockResolvedValue(geo('23.7', '90.4'));
    await call({ 'x-nf-client-connection-ip': '2001:db8::1' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://get.geojs.io/v1/ip/geo/2001%3Adb8%3A%3A1.json');
  });

  it.each([
    '1.2.3.4/../../x',
    '1.2.3.4?x=1',
    'evil.example.com',
    '1.2.3.4:80',
    '999.1.1.1',
    '127.0.0.1',
    '10.1.2.3',
  ])('rejects %j without calling upstream', async (bad) => {
    const res = await call({ 'x-nf-client-connection-ip': bad, 'x-forwarded-for': '8.8.8.8' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('rejects when no client address header is present', async () => {
    const res = await call({});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('flags a location outside Bangladesh so the client does not use it', async () => {
    fetchMock.mockResolvedValue(geo('51.5', '-0.12'));
    const res = await call({ 'x-nf-client-connection-ip': '8.8.4.4' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ latitude: 51.5, longitude: -0.12, isWithinBangladesh: false });
  });

  it('returns a generic error when upstream fails', async () => {
    fetchMock.mockRejectedValue(new Error('secret upstream detail'));
    const res = await call({ 'x-nf-client-connection-ip': '103.4.5.6' });
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain('secret');
    expect(JSON.parse(res.body)).toEqual({ error: 'Location lookup failed' });
  });

  it('returns a generic error on a non-OK upstream or unusable body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    expect((await call({ 'x-nf-client-connection-ip': '103.4.5.6' })).statusCode).toBe(502);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    expect((await call({ 'x-nf-client-connection-ip': '103.4.5.6' })).statusCode).toBe(502);
  });
});
