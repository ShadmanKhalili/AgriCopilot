import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSign, generateKeyPairSync } from 'node:crypto';
import {
  APP_CHECK_JWKS_URL,
  __resetAppCheckCacheForTests,
  appCheckMode,
  verifyAppCheck,
  verifyAppCheckToken,
} from './app-check.ts';

const PROJECT_NUMBER = '123456789012';
const PROJECT_ID = 'my-project';
const KID = 'test-key-1';

const makeKeyPair = () => generateKeyPairSync('rsa', { modulusLength: 2048 });
const pair = makeKeyPair();
const otherPair = makeKeyPair();

const publicJwk = (key: ReturnType<typeof makeKeyPair>['publicKey'], kid = KID) => ({
  ...(key.export({ format: 'jwk' }) as Record<string, string>),
  kid,
  use: 'sig',
  alg: 'RS256',
});

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

const sign = (
  claims: Record<string, unknown>,
  opts: { privateKey?: ReturnType<typeof makeKeyPair>['privateKey']; header?: Record<string, unknown> } = {}
) => {
  const header = opts.header ?? { alg: 'RS256', typ: 'JWT', kid: KID };
  const unsigned = `${b64url(header)}.${b64url(claims)}`;
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(opts.privateKey ?? pair.privateKey)
    .toString('base64url');
  return `${unsigned}.${signature}`;
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

const goodClaims = (overrides: Record<string, unknown> = {}) => ({
  iss: `https://firebaseappcheck.googleapis.com/${PROJECT_NUMBER}`,
  aud: [`projects/${PROJECT_NUMBER}`, `projects/${PROJECT_ID}`],
  sub: '1:123456789012:web:abcdef',
  iat: nowSeconds() - 10,
  exp: nowSeconds() + 3600,
  ...overrides,
});

const requestWith = (token?: string) =>
  new Request('https://example.test/api/ai-proxy', {
    method: 'POST',
    headers: token === undefined ? {} : { 'X-Firebase-AppCheck': token },
  });

let fetchMock: ReturnType<typeof vi.fn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __resetAppCheckCacheForTests();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ keys: [publicJwk(pair.publicKey)] })));
  vi.stubGlobal('fetch', fetchMock);
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  process.env.APP_CHECK_PROJECT_NUMBER = PROJECT_NUMBER;
  delete process.env.APP_CHECK_MODE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.APP_CHECK_MODE;
  delete process.env.APP_CHECK_PROJECT_NUMBER;
});

describe('verifyAppCheckToken', () => {
  it('accepts a valid token', async () => {
    expect(await verifyAppCheckToken(sign(goodClaims()), PROJECT_NUMBER)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(APP_CHECK_JWKS_URL, expect.anything());
  });

  it('accepts a single-string audience for the project number', async () => {
    const token = sign(goodClaims({ aud: `projects/${PROJECT_NUMBER}` }));
    expect(await verifyAppCheckToken(token, PROJECT_NUMBER)).toEqual({ ok: true });
  });

  it('rejects the wrong audience', async () => {
    const token = sign(goodClaims({ aud: ['projects/999', 'projects/other'] }));
    expect(await verifyAppCheckToken(token, PROJECT_NUMBER)).toEqual({ ok: false, reason: 'bad_audience' });
  });

  it('rejects the wrong issuer', async () => {
    const token = sign(goodClaims({ iss: 'https://firebaseappcheck.googleapis.com/999' }));
    expect(await verifyAppCheckToken(token, PROJECT_NUMBER)).toEqual({ ok: false, reason: 'bad_issuer' });
  });

  it('rejects an expired token', async () => {
    const token = sign(goodClaims({ exp: nowSeconds() - 600 }));
    expect(await verifyAppCheckToken(token, PROJECT_NUMBER)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a token signed by another key', async () => {
    const token = sign(goodClaims(), { privateKey: otherPair.privateKey });
    expect(await verifyAppCheckToken(token, PROJECT_NUMBER)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a token whose payload was changed after signing', async () => {
    const [h, , s] = sign(goodClaims({ exp: nowSeconds() - 600 })).split('.');
    const forged = `${h}.${b64url(goodClaims())}.${s}`;
    expect(await verifyAppCheckToken(forged, PROJECT_NUMBER)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a header that is not RS256 (including alg none)', async () => {
    const none = sign(goodClaims(), { header: { alg: 'none', typ: 'JWT', kid: KID } });
    expect(await verifyAppCheckToken(none, PROJECT_NUMBER)).toEqual({ ok: false, reason: 'bad_alg' });
    const hs = sign(goodClaims(), { header: { alg: 'HS256', typ: 'JWT', kid: KID } });
    expect(await verifyAppCheckToken(hs, PROJECT_NUMBER)).toEqual({ ok: false, reason: 'bad_alg' });
  });

  it('rejects a missing or unknown kid', async () => {
    const noKid = sign(goodClaims(), { header: { alg: 'RS256', typ: 'JWT' } });
    expect(await verifyAppCheckToken(noKid, PROJECT_NUMBER)).toEqual({ ok: false, reason: 'missing_kid' });
    const unknown = sign(goodClaims(), { header: { alg: 'RS256', typ: 'JWT', kid: 'nope' } });
    expect(await verifyAppCheckToken(unknown, PROJECT_NUMBER)).toEqual({ ok: false, reason: 'unknown_kid' });
  });

  it('rejects garbage', async () => {
    for (const token of ['', 'abc', 'a.b', 'a.b.c', 'a.b.c.d', 'x'.repeat(5000)]) {
      const result = await verifyAppCheckToken(token, PROJECT_NUMBER);
      expect(result.ok).toBe(false);
    }
  });

  it('caches the keys instead of fetching for every token', async () => {
    await verifyAppCheckToken(sign(goodClaims()), PROJECT_NUMBER);
    await verifyAppCheckToken(sign(goodClaims()), PROJECT_NUMBER);
    await verifyAppCheckToken(sign(goodClaims()), PROJECT_NUMBER);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not refetch more than once a minute for unknown key ids', async () => {
    const unknown = sign(goodClaims(), { header: { alg: 'RS256', typ: 'JWT', kid: 'nope' } });
    await verifyAppCheckToken(unknown, PROJECT_NUMBER);
    await verifyAppCheckToken(unknown, PROJECT_NUMBER);
    await verifyAppCheckToken(unknown, PROJECT_NUMBER);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails when Google cannot be reached and nothing is cached', async () => {
    fetchMock.mockImplementation(async () => new Response('nope', { status: 500 }));
    expect(await verifyAppCheckToken(sign(goodClaims()), PROJECT_NUMBER)).toEqual({
      ok: false,
      reason: 'unknown_kid',
    });
  });
});

describe('verifyAppCheck by mode', () => {
  it('defaults to off and checks nothing', async () => {
    expect(appCheckMode()).toBe('off');
    expect(await verifyAppCheck(requestWith())).toEqual({ ok: true });
    expect(await verifyAppCheck(requestWith('garbage'))).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an unknown mode as off', async () => {
    process.env.APP_CHECK_MODE = 'strict';
    expect(appCheckMode()).toBe('off');
    expect(await verifyAppCheck(requestWith())).toEqual({ ok: true });
  });

  it('monitor: allows a valid token silently', async () => {
    process.env.APP_CHECK_MODE = 'monitor';
    expect(await verifyAppCheck(requestWith(sign(goodClaims())))).toEqual({ ok: true });
    expect(warn).not.toHaveBeenCalled();
  });

  it('monitor: allows but logs a missing token, a bad token and a wrong audience', async () => {
    process.env.APP_CHECK_MODE = 'monitor';
    expect(await verifyAppCheck(requestWith())).toEqual({ ok: true });
    expect(await verifyAppCheck(requestWith('garbage'))).toEqual({ ok: true });
    expect(await verifyAppCheck(requestWith(sign(goodClaims({ aud: ['projects/1'] }))))).toEqual({ ok: true });
    const logged = warn.mock.calls.map((call) => String(call[0]));
    expect(logged).toHaveLength(3);
    expect(logged[0]).toContain('missing_token');
    expect(logged[1]).toContain('malformed_token');
    expect(logged[2]).toContain('bad_audience');
    // The token itself is never logged.
    expect(logged.join('\n')).not.toContain('garbage');
  });

  it('enforce: accepts a valid token', async () => {
    process.env.APP_CHECK_MODE = 'enforce';
    expect(await verifyAppCheck(requestWith(sign(goodClaims())))).toEqual({ ok: true });
  });

  it('enforce: rejects a missing header', async () => {
    process.env.APP_CHECK_MODE = 'enforce';
    expect(await verifyAppCheck(requestWith())).toEqual({ ok: false, reason: 'missing_token' });
  });

  it('enforce: rejects wrong audience, expired and bad signature', async () => {
    process.env.APP_CHECK_MODE = 'enforce';
    expect(await verifyAppCheck(requestWith(sign(goodClaims({ aud: ['projects/1'] }))))).toEqual({
      ok: false,
      reason: 'bad_audience',
    });
    expect(await verifyAppCheck(requestWith(sign(goodClaims({ exp: nowSeconds() - 600 }))))).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(await verifyAppCheck(requestWith(sign(goodClaims(), { privateKey: otherPair.privateKey })))).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('enforce: refuses everything when the project number is not set', async () => {
    process.env.APP_CHECK_MODE = 'enforce';
    delete process.env.APP_CHECK_PROJECT_NUMBER;
    expect(await verifyAppCheck(requestWith(sign(goodClaims())))).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('monitor: a missing project number is logged, not blocking', async () => {
    process.env.APP_CHECK_MODE = 'monitor';
    delete process.env.APP_CHECK_PROJECT_NUMBER;
    expect(await verifyAppCheck(requestWith(sign(goodClaims())))).toEqual({ ok: true });
    expect(String(warn.mock.calls[0][0])).toContain('not_configured');
  });
});
