/**
 * Firebase App Check verification for the AI endpoints.
 *
 * Why: the daily allowance is per account, and accounts (guests, unverified
 * emails) are free to create in bulk by a script. App Check ties a request to
 * a real copy of the web app (reCAPTCHA Enterprise attestation), which a
 * scripted account farm does not have.
 *
 * The client sends the App Check token in the `X-Firebase-AppCheck` header
 * (see `src/appCheck.ts`). The token is a JWT signed by Google (RS256). It is
 * verified here with Node's crypto against Google's public JWKS, so no Admin
 * SDK and no extra package is needed:
 *
 *   https://firebaseappcheck.googleapis.com/v1/jwks
 *
 * Configuration (all optional, OFF by default):
 *
 *   APP_CHECK_MODE            'off' (default) | 'monitor' | 'enforce'
 *   APP_CHECK_PROJECT_NUMBER  the Firebase project NUMBER (not the id)
 *
 * - off:     nothing is checked; no network call is made.
 * - monitor: the token is verified and every failure is logged, but the
 *            request is allowed. Use this for a few days to see the real
 *            failure rate before enforcing.
 * - enforce: a missing or invalid token is refused (the caller answers 401
 *            `{ error: 'app_check' }`). Also refused when
 *            APP_CHECK_PROJECT_NUMBER is not set: the monitor phase is
 *            where that mistake shows up in the logs.
 */

import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import type { JsonWebKey as NodeJsonWebKey } from 'node:crypto';

export const APP_CHECK_HEADER_NAME = 'x-firebase-appcheck';
export const APP_CHECK_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';

/** Keys are cached this long (Google rotates them rarely). */
const JWKS_TTL_MS = 6 * 60 * 60 * 1000;
/** An unknown `kid` forces a refetch, but never more often than this. */
const JWKS_MIN_REFETCH_MS = 60 * 1000;
const JWKS_TIMEOUT_MS = 5000;
/** Allowed clock difference between Google's servers and this one. */
const CLOCK_SKEW_SECONDS = 30;
const MAX_TOKEN_CHARS = 4096;

export type AppCheckMode = 'off' | 'monitor' | 'enforce';

export type AppCheckResult = { ok: true } | { ok: false; reason: string };

/** The configured mode; anything unrecognised means 'off'. */
export const appCheckMode = (): AppCheckMode => {
  const raw = String(process.env.APP_CHECK_MODE || '')
    .trim()
    .toLowerCase();
  return raw === 'monitor' || raw === 'enforce' ? raw : 'off';
};

// ── JWKS cache ───────────────────────────────────────────────────────────

type Jwk = NodeJsonWebKey & { kid?: string };

let cachedKeys: Map<string, Jwk> | null = null;
let cachedAtMs = 0;
let lastFetchAtMs = 0;
let inFlight: Promise<Map<string, Jwk> | null> | null = null;

const fetchKeys = async (): Promise<Map<string, Jwk> | null> => {
  lastFetchAtMs = Date.now();
  try {
    const response = await fetch(APP_CHECK_JWKS_URL, {
      signal: AbortSignal.timeout(JWKS_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data: any = await response.json();
    const keys = new Map<string, Jwk>();
    for (const key of Array.isArray(data?.keys) ? data.keys : []) {
      if (key && key.kty === 'RSA' && typeof key.kid === 'string' && key.n && key.e) {
        keys.set(key.kid, key as Jwk);
      }
    }
    return keys.size > 0 ? keys : null;
  } catch {
    return null;
  }
};

/**
 * The public key for `kid`. Served from memory for ~6 hours; an unknown kid
 * triggers at most one refetch a minute. When Google cannot be reached the
 * stale keys are used rather than failing.
 */
const getKey = async (kid: string): Promise<Jwk | null> => {
  const now = Date.now();
  const fresh = cachedKeys !== null && now - cachedAtMs < JWKS_TTL_MS;
  if (fresh && cachedKeys!.has(kid)) return cachedKeys!.get(kid)!;

  const mayRefetch = !fresh || now - lastFetchAtMs >= JWKS_MIN_REFETCH_MS;
  if (mayRefetch) {
    if (!inFlight) {
      inFlight = fetchKeys().finally(() => {
        inFlight = null;
      });
    }
    const keys = await inFlight;
    if (keys) {
      cachedKeys = keys;
      cachedAtMs = Date.now();
    }
  }
  return cachedKeys?.get(kid) ?? null;
};

/** Test hook: forget cached Google keys. */
export const __resetAppCheckCacheForTests = (): void => {
  cachedKeys = null;
  cachedAtMs = 0;
  lastFetchAtMs = 0;
  inFlight = null;
};

// ── Token verification ───────────────────────────────────────────────────

const decodeSegment = (segment: string): any => {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

/**
 * Verify an App Check JWT. Pure of mode: always verifies, never throws.
 */
export const verifyAppCheckToken = async (
  token: string,
  projectNumber: string
): Promise<AppCheckResult> => {
  if (!token || token.length > MAX_TOKEN_CHARS) return { ok: false, reason: 'malformed_token' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return { ok: false, reason: 'malformed_token' };
  }
  const header = decodeSegment(parts[0]);
  const payload = decodeSegment(parts[1]);
  if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') {
    return { ok: false, reason: 'malformed_token' };
  }
  if (header.alg !== 'RS256') return { ok: false, reason: 'bad_alg' };
  if (typeof header.kid !== 'string' || !header.kid) return { ok: false, reason: 'missing_kid' };

  const jwk = await getKey(header.kid);
  if (!jwk) return { ok: false, reason: 'unknown_kid' };

  let signatureOk = false;
  try {
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    signatureOk = cryptoVerify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      publicKey,
      Buffer.from(parts[2], 'base64url')
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { ok: false, reason: 'bad_signature' };

  // The signature is good, so the claims can now be trusted.
  if (payload.iss !== `https://firebaseappcheck.googleapis.com/${projectNumber}`) {
    return { ok: false, reason: 'bad_issuer' };
  }
  const audiences: unknown[] = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(`projects/${projectNumber}`)) {
    return { ok: false, reason: 'bad_audience' };
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS <= nowSeconds) {
    return { ok: false, reason: 'expired' };
  }
  if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_SECONDS > nowSeconds) {
    return { ok: false, reason: 'not_yet_valid' };
  }
  if (typeof payload.sub !== 'string' || !payload.sub) return { ok: false, reason: 'missing_subject' };
  return { ok: true };
};

/**
 * Check a request's App Check token according to APP_CHECK_MODE.
 *
 * - off:     `{ ok: true }` at once.
 * - monitor: verifies and logs a failure, but still returns `{ ok: true }`.
 * - enforce: returns `{ ok: false, reason }` for a missing or invalid token.
 */
export const verifyAppCheck = async (request: Request): Promise<AppCheckResult> => {
  const mode = appCheckMode();
  if (mode === 'off') return { ok: true };

  const projectNumber = String(process.env.APP_CHECK_PROJECT_NUMBER || '').trim();
  const token = (request.headers.get(APP_CHECK_HEADER_NAME) || '').trim();
  let failure: string | null = null;
  if (!projectNumber) {
    failure = 'not_configured';
  } else if (!token) {
    failure = 'missing_token';
  } else {
    const verified = await verifyAppCheckToken(token, projectNumber);
    if (verified.ok === false) failure = verified.reason;
  }

  if (failure === null) return { ok: true };
  if (mode === 'monitor') {
    // Never log the token itself.
    console.warn(`[app-check] monitor: ${failure} (would be refused in enforce mode)`);
    return { ok: true };
  }
  console.warn(`[app-check] enforce: refused (${failure})`);
  return { ok: false, reason: failure };
};
