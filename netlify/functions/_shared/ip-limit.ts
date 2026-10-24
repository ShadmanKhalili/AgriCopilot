/**
 * A per-IP call ceiling for the endpoints that spend money.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The per-account daily allowance is a floor, not a wall. Firebase email
 * sign-up is open, so anyone can create as many throwaway accounts as they
 * like and spread their calls across them; the daily allowance is counted
 * per account, so 50 accounts means 50 times the allowance. The paid Gemini
 * key sits behind all of it.
 *
 * This is the second wall, and it is the one that stops a *single address*
 * from taking the whole key's budget for itself.
 *
 * ── Why it lives here and not in `netlify.toml` ────────────────────────────
 * Netlify's own code-based rate limiting was implemented first (PR #15:
 * `[redirects.rate_limit]` on `/api/ai-proxy` and `/api/gemini/live-token`).
 * It was deployed and the redirect-rules check passed, but it did not engage
 * on this site's plan: measured against production, 150 requests a minute to
 * `/api/ai-proxy` were all served (401 from the function, no 429 from the
 * platform) and 825 requests in three minutes tripped Netlify's own L4
 * protection, which drops TCP connections for the whole site rather than
 * returning a clean 429.
 *
 * A limiter inside the function is verifiable, returns a clean JSON 429 with
 * a message the farmer can act on, and only touches the AI routes.
 *
 * ── What it is and is not ──────────────────────────────────────────────────
 * The counter lives in the function's memory, so it is per warm instance.
 * With N instances running, the effective ceiling is N times the configured
 * limit. That makes this a floor rather than a hard cap — which is the
 * honest description of it. The hard cap is the key's own rate limit, and
 * the per-account daily allowance sits in between.
 *
 * The limit is deliberately generous because in rural Bangladesh many
 * farmers share one public IP (carrier-grade NAT): a tight per-IP limit
 * would throttle real farmers during a traffic spike. It only bites on
 * traffic no human would generate.
 */

/** How long one window lasts. */
const WINDOW_MS = 60_000;

interface Window {
  startedAt: number;
  count: number;
}

/**
 * One bucket per IP, per scope.
 *
 * `scope` keeps the AI proxy and the live-token endpoint on separate
 * budgets: minting a billable Live session is not the same thing as asking
 * a question, and one must not eat the other's allowance.
 */
const buckets = new Map<string, Window>();

/** How often the sweep runs. */
let lastSweep = 0;

/** Forget windows that are long finished, so the map cannot grow forever. */
const sweep = (now: number): void => {
  if (now - lastSweep < 5 * WINDOW_MS) return;
  lastSweep = now;
  for (const [key, window] of buckets) {
    if (now - window.startedAt > WINDOW_MS) buckets.delete(key);
  }
};

export interface RateLimitResult {
  allowed: boolean;
  /** The IP the decision was made about, or null when it could not be found. */
  ip: string | null;
  /** Calls left in the current window. */
  remaining: number;
  /** Seconds until the window rolls over. */
  retryAfterSeconds: number;
}

/**
 * The caller's IP address, as Netlify sees it.
 *
 * `x-nf-client-connection-ip` is the header Netlify sets for the client
 * address. The others are fallbacks for a self-hosted or proxied deployment.
 */
export const extractClientIp = (request: Request): string | null => {
  const headers = [
    'x-nf-client-connection-ip',
    'cf-connecting-ip',
    'x-real-ip',
  ];
  for (const name of headers) {
    const value = request.headers.get(name);
    if (value) return value.trim();
  }
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
};

/**
 * The same lookup, for a Netlify `Handler` event, whose headers are a plain
 * record rather than a `Headers` object.
 */
export const extractClientIpFromHeaders = (
  headers: Record<string, string | undefined> | undefined | null
): string | null => {
  if (!headers) return null;
  const lower: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') lower[key.toLowerCase()] = value;
  }
  for (const name of ['x-nf-client-connection-ip', 'cf-connecting-ip', 'x-real-ip']) {
    if (lower[name]) return lower[name].trim();
  }
  const forwarded = lower['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
};

/**
 * Count one call against an IP's allowance.
 *
 * When the IP cannot be determined the call is allowed: an unknown address
 * must never be able to lock a whole farm out of the feature.
 */
export const checkIpRateLimit = (
  ip: string | null,
  limitPerMinute: number,
  scope: string
): RateLimitResult => {
  if (!ip || !Number.isFinite(limitPerMinute) || limitPerMinute <= 0) {
    return { allowed: true, ip, remaining: limitPerMinute, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  sweep(now);

  const key = `${scope}|${ip}`;
  const window = buckets.get(key);
  if (!window || now - window.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return {
      allowed: true,
      ip,
      remaining: limitPerMinute - 1,
      retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }

  window.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((window.startedAt + WINDOW_MS - now) / 1000));
  return {
    allowed: window.count <= limitPerMinute,
    ip,
    remaining: Math.max(0, limitPerMinute - window.count),
    retryAfterSeconds,
  };
};

/**
 * The per-minute ceiling for the AI proxy, from the environment.
 *
 * `AI_MAX_CALLS_PER_IP_PER_MINUTE` (default 30) — one farmer cannot reach
 * this, and a script cannot go past it from a single address.
 */
export const aiCallsPerIpPerMinute = (): number => {
  const raw = Number(process.env.AI_MAX_CALLS_PER_IP_PER_MINUTE);
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(1000, Math.trunc(raw));
};

/**
 * The per-minute ceiling for the live-token endpoint.
 *
 * `AI_MAX_LIVE_TOKENS_PER_IP_PER_MINUTE` (default 10) — each token starts a
 * billable Live session, so this is much tighter than the question path.
 */
export const liveTokensPerIpPerMinute = (): number => {
  const raw = Number(process.env.AI_MAX_LIVE_TOKENS_PER_IP_PER_MINUTE);
  if (!Number.isFinite(raw) || raw <= 0) return 10;
  return Math.min(1000, Math.trunc(raw));
};
