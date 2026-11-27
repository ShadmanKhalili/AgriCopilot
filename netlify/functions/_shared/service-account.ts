/**
 * Server-only access to Firestore with the project's service account.
 *
 * Most functions act as the signed-in user, with that user's own token, so
 * the security rules still apply. Area reports are different: the counters
 * belong to nobody, and no farmer may write them directly. Those writes are
 * made here, with a service account, which bypasses the rules. That is why
 * every caller must check and tidy its input first, and why this file is
 * never imported by browser code.
 *
 * Setup: put the service-account key file's JSON (or its base64) in the
 * `FIREBASE_SERVICE_ACCOUNT` environment variable. Without it,
 * `serviceAccountConfigured()` is false and callers answer "not set up yet".
 * No extra npm package is needed: the token is signed with Node's crypto.
 */

import { createHmac, createSign } from 'node:crypto';

const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-48b5516c-2b1e-4742-b49f-c9c3397058d0';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/datastore';
const TIMEOUT_MS = 8000;

interface ServiceAccount {
  client_email: string;
  private_key: string;
  private_key_id?: string;
  project_id?: string;
}

let parsed: ServiceAccount | null | undefined;

const readServiceAccount = (): ServiceAccount | null => {
  if (parsed !== undefined) return parsed;
  parsed = null;
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return parsed;
  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const account = JSON.parse(json);
    if (
      typeof account?.client_email === 'string' &&
      typeof account?.private_key === 'string' &&
      account.private_key.includes('PRIVATE KEY')
    ) {
      parsed = {
        client_email: account.client_email,
        // Keys pasted into an environment variable often carry literal "\n".
        private_key: account.private_key.replace(/\\n/g, '\n'),
        private_key_id: typeof account.private_key_id === 'string' ? account.private_key_id : undefined,
        project_id: typeof account.project_id === 'string' ? account.project_id : undefined,
      };
    }
  } catch {
    // A malformed value is treated as "not set up". Never log the value.
    console.warn('[service-account] FIREBASE_SERVICE_ACCOUNT could not be read.');
  }
  return parsed;
};

/** True when a usable service account is configured. */
export const serviceAccountConfigured = (): boolean => readServiceAccount() !== null;

const projectId = (): string =>
  process.env.FIREBASE_PROJECT_ID || readServiceAccount()?.project_id || 'studio-1309545077-89018';

/** Root of this project's Firestore REST API, e.g. `${base}/documents/...`. */
export const firestoreBase = (): string =>
  `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/${DATABASE_ID}`;

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

let cachedToken: { value: string; expiresAtMs: number } | null = null;

/**
 * A short-lived access token for Firestore. Cached in memory until a minute
 * before it expires. Throws when no service account is configured or Google
 * refuses the key.
 */
export const getAccessToken = async (): Promise<string> => {
  const account = readServiceAccount();
  if (!account) throw new Error('service_account_not_configured');
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - 60_000 > now) return cachedToken.value;

  const iat = Math.floor(now / 1000);
  const header = { alg: 'RS256', typ: 'JWT', ...(account.private_key_id ? { kid: account.private_key_id } : {}) };
  const claims = { iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key);
  const assertion = `${unsigned}.${b64url(signature)}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`service_account_token_failed_${response.status}`);
  const data: any = await response.json();
  if (typeof data?.access_token !== 'string') throw new Error('service_account_token_missing');
  cachedToken = {
    value: data.access_token,
    expiresAtMs: now + Math.max(60, Number(data.expires_in) || 3600) * 1000,
  };
  return cachedToken.value;
};

/**
 * Call the Firestore REST API as the service account.
 * `path` starts after the database root, for example `/documents/area_summaries/x`
 * or `/documents:runQuery`.
 */
export const adminFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const token = await getAccessToken();
  return fetch(`${firestoreBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });
};

/**
 * A stable code for a user that cannot be turned back into their uid without
 * the service-account key. Used as the id of private reporter documents, so
 * even someone reading the database cannot list who reported what.
 */
export const anonymousId = (uid: string): string => {
  const account = readServiceAccount();
  if (!account) throw new Error('service_account_not_configured');
  return createHmac('sha256', account.private_key).update(`area-report:${uid}`).digest('hex').slice(0, 32);
};

/** A plain value as a Firestore REST `Value`. */
export const toFirestoreValue = (value: unknown): any => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, toFirestoreValue(inner)])
        ),
      },
    };
  }
  return { nullValue: null };
};

/** A Firestore REST `Value` as a plain value. */
export const fromFirestoreValue = (value: any): unknown => {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue?.fields || {}).map(([key, inner]) => [key, fromFirestoreValue(inner)])
    );
  }
  return null;
};

/** A Firestore REST document's fields as a plain object. */
export const fromFirestoreDocument = (document: any): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(document?.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)])
  );
