/**
 * Firebase ID token verification for the Netlify functions.
 *
 * The Netlify functions are the production path (see `netlify.toml`, which
 * rewrites `/api/*` to `/.netlify/functions/:splat`). The Express server in
 * `server.ts` is the dev / self-hosted path.
 *
 * Until now the AI proxy accepted an anonymous POST and forwarded it straight
 * to the paid Gemini key, which turned a paid API key into an open, uncapped
 * relay for anyone on the internet. Every AI call now has to carry a Firebase
 * ID token that belongs to a real account, so the proxy can both attribute
 * usage and enforce a per-user quota.
 */

// The Firebase Web API key is a public client identifier (it ships in every
// browser bundle) and is only used here to call the Identity Toolkit's
// `accounts:lookup` endpoint, which is what actually verifies the token
// signature, expiry and audience. It grants no data access on its own.
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyDqhnhkuIB8pcEDI7_papurm7cHHoKJe7A';

const IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

export interface VerifiedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

/**
 * Pull the bearer token out of an Authorization header value.
 * Returns null when the header is missing or malformed.
 */
export const extractBearerTokenFromHeader = (header: string | null | undefined): string | null => {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(String(header).trim());
  return match ? match[1] : null;
};

/**
 * Pull the bearer token out of a request's Authorization header.
 */
export const extractBearerToken = (request: Request): string | null =>
  extractBearerTokenFromHeader(
    request.headers.get('authorization') || request.headers.get('Authorization')
  );

/**
 * Verify a Firebase ID token against the project's Identity Toolkit.
 *
 * The token signature and expiry are checked by Google, not by decoding the
 * JWT locally — a decoded payload proves nothing on its own.
 */
export const verifyIdToken = async (idToken: string): Promise<VerifiedUser | null> => {
  try {
    const response = await fetch(`${IDENTITY_TOOLKIT}?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data: any = await response.json();
    const user = data?.users?.[0];
    if (!user?.localId) return null;
    return {
      uid: String(user.localId),
      email: user.email ? String(user.email) : null,
      emailVerified: !!user.emailVerified,
    };
  } catch {
    return null;
  }
};

/**
 * Verify the caller of a request and return their account.
 *
 * Returns `{ user: null }` for a missing or invalid token — the caller turns
 * that into a 401.
 */
export const authenticate = async (
  request: Request
): Promise<{ user: VerifiedUser | null; reason?: string }> => {
  const token = extractBearerToken(request);
  if (!token) {
    return { user: null, reason: 'missing_token' };
  }
  const user = await verifyIdToken(token);
  if (!user) {
    return { user: null, reason: 'invalid_token' };
  }
  return { user };
};
