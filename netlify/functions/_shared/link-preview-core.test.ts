import { beforeEach, describe, expect, it, vi } from 'vitest';

// Name lookups are answered locally so the tests need no network.
vi.mock('./safe-url.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./safe-url.ts')>();
  return {
    ...actual,
    validateOutboundUrl: (url: string) =>
      actual.validateOutboundUrl(url, async (host: string) => {
        if (host === 'gone.example') throw new Error('ENOTFOUND');
        return [{ address: '93.184.216.34', family: 4 }];
      }),
  };
});

import { LINK_PREVIEW_MAX_BYTES, handleLinkPreview, isPublicPreviewHost } from './link-preview-core.ts';

const html = (head: string) => `<html><head>${head}</head><body></body></html>`;
const page = (head: string, init: ResponseInit = {}) =>
  new Response(html(head), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });

let ipCounter = 0;
const freshIp = () => `198.51.100.${(ipCounter += 1)}`;

const signedIn = vi.fn(async () => ({ uid: 'u1', email: null, emailVerified: false, isGuest: true }));
const signedOut = vi.fn(async () => null);

const request = (over: Record<string, unknown> = {}) => ({
  method: 'GET',
  url: 'https://news.example.org/story',
  authorization: 'Bearer good-token',
  ip: freshIp(),
  ...over,
});

beforeEach(() => {
  delete process.env.LINK_PREVIEW_MAX_CALLS_PER_IP_PER_MINUTE;
  delete process.env.LINK_PREVIEW_PUBLIC_HOSTS;
  signedIn.mockClear();
  signedOut.mockClear();
});

describe('handleLinkPreview: method and limits', () => {
  it.each(['POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'])('refuses %s', async (method) => {
    const fetchPage = vi.fn();
    const r = await handleLinkPreview(request({ method }), { fetchPage: fetchPage as any, verifyToken: signedIn });
    expect(r.status).toBe(405);
    expect(r.headers.Allow).toBe('GET');
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('limits each IP address per minute', async () => {
    process.env.LINK_PREVIEW_MAX_CALLS_PER_IP_PER_MINUTE = '2';
    const ip = freshIp();
    const fetchPage = vi.fn(async () => page('<title>T</title>'));
    const run = () => handleLinkPreview(request({ ip }), { fetchPage: fetchPage as any, verifyToken: signedIn });
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(200);
    const third = await run();
    expect(third.status).toBe(429);
    expect(Number(third.headers['Retry-After'])).toBeGreaterThan(0);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('requires a url and rejects anything that is not an http(s) address', async () => {
    const deps = { fetchPage: vi.fn() as any, verifyToken: signedIn };
    expect((await handleLinkPreview(request({ url: undefined }), deps)).status).toBe(400);
    expect((await handleLinkPreview(request({ url: 'not a url' }), deps)).status).toBe(400);
    expect((await handleLinkPreview(request({ url: 'file:///etc/passwd' }), deps)).status).toBe(400);
    expect((await handleLinkPreview(request({ url: `https://a.example/${'x'.repeat(3000)}` }), deps)).status).toBe(400);
    expect(deps.fetchPage).not.toHaveBeenCalled();
  });
});

describe('handleLinkPreview: who may preview what', () => {
  it('turns away a signed-out caller for a host outside the allow-list', async () => {
    const fetchPage = vi.fn();
    const none = await handleLinkPreview(request({ authorization: undefined }), { fetchPage: fetchPage as any, verifyToken: signedOut });
    expect(none.status).toBe(401);
    const bad = await handleLinkPreview(request(), { fetchPage: fetchPage as any, verifyToken: signedOut });
    expect(bad.status).toBe(401);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('lets a signed-in account (a guest included) preview any public host', async () => {
    const fetchPage = vi.fn(async () => page('<title>News</title>'));
    const r = await handleLinkPreview(request(), { fetchPage: fetchPage as any, verifyToken: signedIn });
    expect(r.status).toBe(200);
    expect(signedIn).toHaveBeenCalledWith('good-token');
  });

  it('lets anyone preview the official sites the scheme pages link to', async () => {
    const fetchPage = vi.fn(async () => page('<title>DAE</title>'));
    const r = await handleLinkPreview(request({ url: 'https://dae.gov.bd/', authorization: undefined }), {
      fetchPage: fetchPage as any,
      verifyToken: signedOut,
    });
    expect(r.status).toBe(200);
    expect(r.body.title).toBe('DAE');
    expect(signedOut).not.toHaveBeenCalled();
  });

  it('matches allow-listed hosts on a label boundary only', () => {
    expect(isPublicPreviewHost('dae.gov.bd')).toBe(true);
    expect(isPublicPreviewHost('GOV.BD')).toBe(true);
    expect(isPublicPreviewHost('www.krishibank.org.bd')).toBe(true);
    expect(isPublicPreviewHost('evilgov.bd')).toBe(false);
    expect(isPublicPreviewHost('gov.bd.evil.com')).toBe(false);
    expect(isPublicPreviewHost('127.0.0.1')).toBe(false);
    process.env.LINK_PREVIEW_PUBLIC_HOSTS = 'partner.example';
    expect(isPublicPreviewHost('a.partner.example')).toBe(true);
  });
});

describe('handleLinkPreview: destinations and errors', () => {
  const deps = () => ({ fetchPage: vi.fn() as any, verifyToken: signedIn });

  it.each(['http://127.0.0.1/', 'http://169.254.169.254/latest', 'http://localhost:8080/', 'http://[::1]/', 'http://10.0.0.1/'])(
    'refuses %s with a generic message',
    async (url) => {
      const d = deps();
      const r = await handleLinkPreview(request({ url }), d);
      expect(r.status).toBe(403);
      expect(r.body.error).toBe('This link cannot be previewed.');
      expect(d.fetchPage).not.toHaveBeenCalled();
    }
  );

  it('keeps the "could not be resolved" message the client uses to flag a dead site', async () => {
    const r = await handleLinkPreview(request({ url: 'https://gone.example/' }), deps());
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('Host could not be resolved');
  });

  it('returns a generic restricted card, with no error detail, when the fetch fails', async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED 10.1.2.3:443 secret-internal-detail');
    });
    const r = await handleLinkPreview(request(), { fetchPage: fetchPage as any, verifyToken: signedIn });
    expect(r.status).toBe(200);
    expect(r.body.isRestricted).toBe(true);
    expect(JSON.stringify(r.body)).not.toMatch(/ECONNREFUSED|secret-internal-detail|10\.1\.2\.3/);
  });

  it('falls back the same way when the page is over the size cap', async () => {
    const big = new Response(new Blob([new Uint8Array(LINK_PREVIEW_MAX_BYTES + 1024)]), {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
    const r = await handleLinkPreview(request(), { fetchPage: (async () => big) as any, verifyToken: signedIn });
    expect(r.body.isRestricted).toBe(true);
  });

  it('asks the fetcher for at most the preview size cap', async () => {
    const fetchPage = vi.fn(async () => page('<title>T</title>'));
    await handleLinkPreview(request(), { fetchPage: fetchPage as any, verifyToken: signedIn });
    expect((fetchPage.mock.calls[0] as any[])[2]).toEqual({ maxBytes: LINK_PREVIEW_MAX_BYTES });
  });

  it('does not read the body of a non-HTML response', async () => {
    const res = new Response('%PDF-1.4 ...', { status: 200, headers: { 'content-type': 'application/pdf' } });
    const cancel = vi.spyOn(res.body!, 'cancel');
    const r = await handleLinkPreview(request(), { fetchPage: (async () => res) as any, verifyToken: signedIn });
    expect(r.body.isRestricted).toBe(true);
    expect(cancel).toHaveBeenCalled();
  });
});

describe('handleLinkPreview: response shape', () => {
  it('returns title, description, image, siteName and url', async () => {
    const head =
      '<meta property="og:title" content="Rice subsidy"> <meta property="og:description" content="Fertiliser support"> ' +
      '<meta property="og:image" content="/img/cover.png"> <meta property="og:site_name" content="Krishi">';
    const r = await handleLinkPreview(request({ url: 'http://news.example.org/a' }), {
      fetchPage: (async () => page(head)) as any,
      verifyToken: signedIn,
    });
    expect(r.status).toBe(200);
    expect(r.headers['Content-Type']).toBe('application/json');
    expect(r.body).toEqual({
      title: 'Rice subsidy',
      description: 'Fertiliser support',
      // Relative path resolved, http upgraded to https.
      image: 'https://news.example.org/img/cover.png',
      siteName: 'Krishi',
      url: 'http://news.example.org/a',
    });
  });

  it('drops an image that is not a web address', async () => {
    const r = await handleLinkPreview(request(), {
      fetchPage: (async () => page('<meta property="og:image" content="javascript:alert(1)"><title>T</title>')) as any,
      verifyToken: signedIn,
    });
    expect(r.body.image).toBeUndefined();
    expect(r.body.title).toBe('T');
  });

  it('marks 404 and 403 pages as restricted', async () => {
    const r = await handleLinkPreview(request(), {
      fetchPage: (async () => page('', { status: 404 })) as any,
      verifyToken: signedIn,
    });
    expect(r.body).toMatchObject({ isRestricted: true, title: 'Portal Not Found' });
  });
});
