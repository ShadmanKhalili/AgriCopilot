import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dailyForecast, { config as dailyConfig } from '../daily-forecast.ts';
import historicalData from '../historical-data.ts';
import locLookup from '../loc-lookup.ts';
import wbIndicators from '../wb-indicators.ts';
import soilProperties from '../soil-properties.ts';
import configStatus from '../config-status.ts';
import sentinel, { config as sentinelConfig } from '../sentinel.ts';

/**
 * The unauthenticated data proxies: strict inputs, an allowlist of upstream
 * parameters, no CORS header, generic errors and a per-IP limit. fetch is
 * mocked, so nothing here touches the network.
 */

let fetchMock: ReturnType<typeof vi.fn>;
let ipCounter = 0;
// Each test gets its own address so the in-memory limiter never leaks between tests.
const freshIp = () => `203.0.113.${(++ipCounter % 250) + 1}`;

const get = (handler: any, url: string, ip = freshIp()) =>
  handler(new Request(`http://localhost${url}`, { headers: { 'x-nf-client-connection-ip': ip } }));

const upstreamUrl = () => new URL(String(fetchMock.mock.calls[0][0]));

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const noCors = (res: Response) => expect(res.headers.get('access-control-allow-origin')).toBeNull();

describe('daily-forecast', () => {
  const ok =
    '/api/daily-forecast?latitude=23.81234567890123&longitude=90.41&current=temperature_2m,wind_speed_10m&hourly=precipitation&daily=uv_index_max&timezone=auto&_t=123';

  it('forwards only an allowlist of validated parameters', async () => {
    const res = await get(dailyForecast, ok);
    expect(res.status).toBe(200);
    noCors(res);
    const url = upstreamUrl();
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect([...url.searchParams.keys()].sort()).toEqual(['current', 'daily', 'hourly', 'latitude', 'longitude', 'timezone']);
    expect(url.searchParams.get('latitude')).toBe('23.812');
    expect(url.searchParams.get('current')).toBe('temperature_2m,wind_speed_10m');
  });

  it('cannot be used to add upstream parameters', async () => {
    const res = await get(
      dailyForecast,
      '/api/daily-forecast?latitude=23&longitude=90&current=temperature_2m%26past_days%3D9999'
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    const clean = await get(dailyForecast, '/api/daily-forecast?latitude=23&longitude=90&forecast_days=300&models=x');
    expect(clean.status).toBe(200);
    expect([...upstreamUrl().searchParams.keys()].sort()).toEqual(['latitude', 'longitude', 'timezone']);
  });

  it.each([
    '/api/daily-forecast',
    '/api/daily-forecast?latitude=91&longitude=90',
    '/api/daily-forecast?latitude=23&longitude=181',
    '/api/daily-forecast?latitude=abc&longitude=90',
    '/api/daily-forecast?latitude=23&longitude=90%26x%3D1',
  ])('rejects %s', async (url) => {
    const res = await get(dailyForecast, url);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forces timezone to auto or Asia/Dhaka', async () => {
    await get(dailyForecast, '/api/daily-forecast?latitude=23&longitude=90&timezone=Evil/Zone%26x%3D1');
    expect(upstreamUrl().searchParams.get('timezone')).toBe('auto');
  });

  it('returns a generic error when the upstream fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:443 secret-detail'));
    const res = await get(dailyForecast, '/api/daily-forecast?latitude=23&longitude=90');
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret-detail');
  });

  it('hides the upstream status and body on a non-2xx answer', async () => {
    fetchMock.mockResolvedValueOnce(new Response('upstream-internal-detail', { status: 500 }));
    const res = await get(dailyForecast, '/api/daily-forecast?latitude=23&longitude=90');
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('upstream-internal-detail');
  });

  it('only accepts GET', async () => {
    const res = await dailyForecast(new Request('http://localhost/api/daily-forecast', { method: 'POST' }));
    expect(res.status).toBe(405);
  });

  it('limits one address per minute', async () => {
    const ip = freshIp();
    let last: Response | undefined;
    for (let i = 0; i < dailyConfig!.rateLimit!.windowLimit + 5; i++) {
      last = await get(dailyForecast, '/api/daily-forecast?latitude=23&longitude=90', ip);
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get('retry-after')).toBeTruthy();
  });

  it('declares its own route and platform rate limit', () => {
    expect(dailyConfig!.path).toBe('/api/daily-forecast');
    expect(dailyConfig!.rateLimit!.aggregateBy).toEqual(['ip', 'domain']);
  });
});

describe('historical-data', () => {
  const ok =
    '/api/historical-data?latitude=23.8&longitude=90.4&start_date=2025-11-01&end_date=2025-11-30&daily=temperature_2m_max&timezone=auto';

  it('forwards the validated parameters only', async () => {
    const res = await get(historicalData, ok + '&extra=1');
    expect(res.status).toBe(200);
    noCors(res);
    expect([...upstreamUrl().searchParams.keys()].sort()).toEqual([
      'daily',
      'end_date',
      'latitude',
      'longitude',
      'start_date',
      'timezone',
    ]);
  });

  it.each([
    '/api/historical-data?latitude=23&longitude=90&start_date=2025-11-01',
    '/api/historical-data?latitude=23&longitude=90&start_date=2025-13-01&end_date=2025-12-01',
    '/api/historical-data?latitude=23&longitude=90&start_date=2025-02-30&end_date=2025-03-01',
    '/api/historical-data?latitude=23&longitude=90&start_date=2025-12-01&end_date=2025-11-01',
    '/api/historical-data?latitude=23&longitude=90&start_date=1950-01-01&end_date=2025-11-01',
    '/api/historical-data?latitude=23&longitude=90&start_date=2025-11-01&end_date=2025-11-02&daily=a%26b',
  ])('rejects %s', async (url) => {
    expect((await get(historicalData, url)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('loc-lookup', () => {
  it('forwards only latitude, longitude and a two-letter language', async () => {
    const res = await get(
      locLookup,
      '/api/loc-lookup?latitude=23.8123&longitude=90.4&localityLanguage=bn&key=stolen&callback=x'
    );
    expect(res.status).toBe(200);
    noCors(res);
    const url = upstreamUrl();
    expect(url.origin + url.pathname).toBe('https://api.bigdatacloud.net/data/reverse-geocode-client');
    expect([...url.searchParams.keys()].sort()).toEqual(['latitude', 'localityLanguage', 'longitude']);
    expect(url.searchParams.get('localityLanguage')).toBe('bn');
  });

  it('defaults a malformed language to en and rejects bad coordinates', async () => {
    await get(locLookup, '/api/loc-lookup?latitude=23&longitude=90&localityLanguage=bn%26x%3D1');
    expect(upstreamUrl().searchParams.get('localityLanguage')).toBe('en');
    expect((await get(locLookup, '/api/loc-lookup?latitude=99&longitude=90')).status).toBe(400);
  });

  it('never returns the error message', async () => {
    fetchMock.mockRejectedValueOnce(new Error('BigDataCloud API error: 500 internal'));
    const res = await get(locLookup, '/api/loc-lookup?latitude=23&longitude=90');
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('BigDataCloud');
  });
});

describe('wb-indicators', () => {
  it('builds the upstream path from validated, encoded segments', async () => {
    const res = await get(wbIndicators, '/api/wb-indicators?country=bgd&ind=sp.pop.totl&date=2015:2023&per_page=50&evil=1');
    expect(res.status).toBe(200);
    noCors(res);
    const url = upstreamUrl();
    expect(url.pathname).toBe('/v2/country/BGD/indicator/SP.POP.TOTL');
    expect([...url.searchParams.keys()].sort()).toEqual(['date', 'format', 'per_page']);
  });

  it.each([
    'country=BGD/../../x&ind=SP.POP.TOTL',
    'country=BGD&ind=SP.POP.TOTL/../../v2/sources',
    'country=BGD&ind=SP.POP.TOTL%3Fformat%3Dxml',
    'country=BGDX&ind=SP.POP.TOTL',
    'country=BGD&ind=AB',
    'country=BGD&ind=SP.POP.TOTL&date=1;2',
    'country=BGD&ind=SP.POP.TOTL&per_page=100000',
    'country=BGD&ind=SP.POP.TOTL&page=0',
    'ind=SP.POP.TOTL',
  ])('rejects %s', async (qs) => {
    expect((await get(wbIndicators, `/api/wb-indicators?${qs}`)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never returns the upstream error message', async () => {
    fetchMock.mockResolvedValueOnce(new Response('x', { status: 503 }));
    const res = await get(wbIndicators, '/api/wb-indicators?country=BGD&ind=SP.POP.TOTL');
    expect(res.status).toBe(502);
    expect(await res.text()).not.toMatch(/503|World Bank/);
  });
});

describe('soil-properties', () => {
  const ok =
    '/api/soil-properties?lon=90.4&lat=23.8&property=phh2o&property=nitrogen&property=soc&depth=0-5cm&value=mean';

  it('forwards repeated allowlisted parameters', async () => {
    const res = await get(soilProperties, ok);
    expect(res.status).toBe(200);
    noCors(res);
    const url = upstreamUrl();
    expect(url.searchParams.getAll('property')).toEqual(['phh2o', 'nitrogen', 'soc']);
    expect(url.searchParams.getAll('depth')).toEqual(['0-5cm']);
    expect(url.searchParams.getAll('value')).toEqual(['mean']);
    expect(url.searchParams.get('lat')).toBe('23.8');
  });

  it('accepts comma-separated properties', async () => {
    await get(soilProperties, '/api/soil-properties?lat=23&lon=90&property=phh2o,clay');
    expect(upstreamUrl().searchParams.getAll('property')).toEqual(['phh2o', 'clay']);
  });

  it.each([
    '/api/soil-properties?lat=23&lon=90',
    '/api/soil-properties?lat=23&lon=90&property=notaproperty',
    '/api/soil-properties?lat=23&lon=90&property=phh2o&depth=0-5cm%26x%3D1',
    '/api/soil-properties?lat=23&lon=90&property=phh2o&value=evil',
    '/api/soil-properties?lat=23&lon=90&property=phh2o,nitrogen,soc,clay,sand,silt,cec,bdod,ocd',
    '/api/soil-properties?lat=95&lon=90&property=phh2o',
  ])('rejects %s', async (url) => {
    expect((await get(soilProperties, url)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('config-status', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('reports booleans only and ignores the browser VITE_ key for the live forecast', async () => {
    delete process.env.GOOGLE_WEATHER_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.MAPS_API_KEY;
    process.env.VITE_GOOGLE_MAPS_API_KEY = 'browser-key-123';
    const res = await get(configStatus, '/api/config-status');
    const text = await res.text();
    noCors(res);
    expect(text).not.toContain('browser-key-123');
    const body = JSON.parse(text);
    expect(body.weatherNextConfigured).toBe(false);
    expect(body.googleMapsConfigured).toBe(true);
  });

  it('only accepts GET', async () => {
    const res = await configStatus(new Request('http://localhost/api/config-status', { method: 'POST' }));
    expect(res.status).toBe(405);
  });
});

describe('sentinel', () => {
  const post = (body: unknown, ip = freshIp()) =>
    sentinel(
      new Request('http://localhost/api/sentinel', {
        method: 'POST',
        headers: { 'x-nf-client-connection-ip': ip, 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      })
    );

  it('serves the model reading for valid coordinates without credentials', async () => {
    const saved = { id: process.env.SENTINEL_HUB_CLIENT_ID, secret: process.env.SENTINEL_HUB_CLIENT_SECRET };
    delete process.env.SENTINEL_HUB_CLIENT_ID;
    delete process.env.SENTINEL_HUB_CLIENT_SECRET;
    try {
      const res = await post({ lat: 23.81234567, lng: 90.4 });
      expect(res.status).toBe(200);
      noCors(res);
      expect((await res.json()).source).toBe('agro_climatic_model');
    } finally {
      if (saved.id !== undefined) process.env.SENTINEL_HUB_CLIENT_ID = saved.id;
      if (saved.secret !== undefined) process.env.SENTINEL_HUB_CLIENT_SECRET = saved.secret;
    }
  });

  it.each([{ lat: 91, lng: 90 }, { lat: 23, lng: 181 }, { lat: 'x', lng: 90 }, {}, null, 'not json'])(
    'rejects %j',
    async (body) => {
      expect((await post(body as any)).status).toBe(400);
    }
  );

  it('rejects an oversized body and non-POST', async () => {
    expect((await post({ lat: 1, lng: 1, pad: 'x'.repeat(3000) })).status).toBe(413);
    expect((await sentinel(new Request('http://localhost/api/sentinel'))).status).toBe(405);
  });

  it('declares its own route and platform rate limit', () => {
    expect(sentinelConfig!.path).toBe('/api/sentinel');
    expect(sentinelConfig!.rateLimit!.windowLimit).toBeGreaterThan(0);
  });
});
