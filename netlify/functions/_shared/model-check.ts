/**
 * Admin-only AI model check: the pure parts.
 *
 * Code comments in this repo say `gemini-3.8-flash` answers 404 on the
 * project's key and that the `googleSearch` tool is refused, while Google's
 * docs list both as available. This module runs a handful of tiny calls so an
 * admin can see what the key really serves today, without a developer reading
 * logs.
 *
 * Nothing here knows about Netlify. The function file wires in the Firebase
 * check and the key; the tests drive `runModelChecks` with a fake probe.
 *
 * What a result never contains: the API key, the provider's response body or
 * the provider's own error text. A failure is a short code plus one fixed
 * plain-English sentence chosen from the HTTP status.
 */

/** The only account allowed to run the check. Mirrors `isAdmin()` in firestore.rules. */
export const ADMIN_EMAIL = 'sadmankhalili@gmail.com';

/**
 * True when a verified Firebase account is the administrator.
 * Needs a verified email, as the security rules do.
 */
export const isAdminUser = (user: { email?: string | null; emailVerified?: boolean } | null | undefined): boolean =>
  !!user && user.emailVerified === true && String(user.email || '').trim().toLowerCase() === ADMIN_EMAIL;

export type CheckFeature = 'text' | 'search' | 'tts';

export interface CheckSpec {
  model: string;
  feature: CheckFeature;
}

/** The text models the AI proxy may use (see ai-proxy.ts allow-list). */
export const TEXT_MODELS_TO_CHECK = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
] as const;

/** The model the app sends Google Search grounding to (SEARCH_MODEL in src/services/ai.ts). */
export const SEARCH_MODEL_TO_CHECK = 'gemini-3.6-flash';

/** The primary text-to-speech model (TTS_PRIMARY_MODEL in src/services/ai.ts). */
export const TTS_MODEL_TO_CHECK = 'gemini-3.8-flash-lite-tts';

/** The fixed list of checks: one text call per model, one search call, one speech call. */
export const planChecks = (): CheckSpec[] => [
  ...TEXT_MODELS_TO_CHECK.map((model): CheckSpec => ({ model, feature: 'text' })),
  { model: SEARCH_MODEL_TO_CHECK, feature: 'search' },
  { model: TTS_MODEL_TO_CHECK, feature: 'tts' },
];

/** Time allowed for one call. */
export const PER_CALL_TIMEOUT_MS = 6_500;
/** The whole run must finish inside this, under Netlify's default 10 s function limit. */
export const TOTAL_BUDGET_MS = 9_000;
/** Calls in flight at once: all of them (there are only six), so the run is one round trip. */
export const CONCURRENCY = 6;
/** Output tokens asked for by a text or search call. */
export const MAX_OUTPUT_TOKENS = 64;

// ── The provider call ────────────────────────────────────────────────────────

/** What a probe reports about one finished HTTP call. */
export interface ProbeOutcome {
  /** HTTP status of the provider's answer. */
  status: number;
  /** The provider's status word (`NOT_FOUND`, `PERMISSION_DENIED`...), if it sent a plain one. */
  errorStatus?: string | null;
  /** On a 200: whether the answer carried text or audio. */
  hasOutput?: boolean;
}

/**
 * Makes one call and reports its outcome. It rejects on a network failure or
 * when `signal` aborts; it must not reject for a non-2xx answer.
 */
export type Probe = (spec: CheckSpec, signal: AbortSignal) => Promise<ProbeOutcome>;

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** The request body for one check. */
export const buildProbeBody = (spec: CheckSpec): Record<string, unknown> => {
  if (spec.feature === 'tts') {
    return {
      contents: [{ parts: [{ text: 'Hello' }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    };
  }
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: 'Reply with OK' }] }],
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
  if (spec.feature === 'search') body.tools = [{ googleSearch: {} }];
  return body;
};

/** A Gemini REST error `status` word, kept only when it is a plain upper-case code. */
const plainStatusWord = (value: unknown): string | null =>
  typeof value === 'string' && /^[A-Z_]{3,40}$/.test(value) ? value : null;

const answerHasOutput = (data: any): boolean => {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return false;
  return parts.some((part: any) => (typeof part?.text === 'string' && part.text.length > 0) || !!part?.inlineData?.data);
};

/**
 * The real probe. The key travels in a request header, never in the URL, and
 * the answer is reduced to a status, a status word and a yes/no before it
 * leaves this function.
 */
export const createGeminiProbe =
  (apiKey: string, fetchImpl: typeof fetch = fetch): Probe =>
  async (spec, signal) => {
    const response = await fetchImpl(`${GEMINI_BASE}/${encodeURIComponent(spec.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildProbeBody(spec)),
      signal,
    });
    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      return { status: response.status, errorStatus: plainStatusWord(data?.error?.status) };
    }
    return { status: response.status, hasOutput: answerHasOutput(data) };
  };

// ── Shaping results ──────────────────────────────────────────────────────────

export interface ModelCheckResult {
  model: string;
  feature: CheckFeature;
  ok: boolean;
  /** HTTP status of the provider's answer; null when there was none. */
  status: number | null;
  latencyMs: number;
  /** A short code: the provider's status word, `timeout`, `network`, `empty`, `skipped`. */
  errorCode?: string;
  /** One fixed sentence, chosen from the code. Never the provider's own text. */
  message?: string;
}

/** The fixed sentence for a failure. Chosen from the code and status only. */
export const describeFailure = (
  feature: CheckFeature,
  status: number | null,
  errorCode: string | undefined
): string => {
  if (errorCode === 'timeout') return 'No answer in time.';
  if (errorCode === 'network') return 'Could not reach the AI service.';
  if (errorCode === 'skipped') return 'Not run: the time limit for this check was reached.';
  if (errorCode === 'empty') return 'The call worked but returned nothing.';
  if (status === 404) return 'The model was not found, or is not available to this key.';
  if (status === 401 || status === 403) return 'The key is not allowed to use this.';
  if (status === 429) return 'Quota or rate limit reached.';
  if (status !== null && status >= 500) return 'The AI service had a temporary problem.';
  if (status === 400) {
    return feature === 'search'
      ? 'The request was refused. Google Search may not be allowed for this key.'
      : 'The request was refused.';
  }
  return 'The call failed.';
};

const failure = (
  spec: CheckSpec,
  status: number | null,
  latencyMs: number,
  errorCode: string
): ModelCheckResult => ({
  model: spec.model,
  feature: spec.feature,
  ok: false,
  status,
  latencyMs,
  errorCode,
  message: describeFailure(spec.feature, status, errorCode),
});

export interface RunOptions {
  concurrency?: number;
  perCallTimeoutMs?: number;
  totalBudgetMs?: number;
  now?: () => number;
}

/**
 * Runs the checks (by default all at once), each under its own timeout capped
 * by the total budget; a call that times out is reported as `timeout`. Calls
 * that would start after the budget is spent are reported as `skipped`.
 * Results come back in the order of `specs`.
 */
export const runModelChecks = async (
  probe: Probe,
  specs: CheckSpec[] = planChecks(),
  options: RunOptions = {}
): Promise<ModelCheckResult[]> => {
  const concurrency = Math.max(1, options.concurrency ?? CONCURRENCY);
  const perCallTimeoutMs = options.perCallTimeoutMs ?? PER_CALL_TIMEOUT_MS;
  const totalBudgetMs = options.totalBudgetMs ?? TOTAL_BUDGET_MS;
  const now = options.now ?? Date.now;
  const startedAt = now();

  const results: ModelCheckResult[] = new Array(specs.length);
  let next = 0;

  const runOne = async (spec: CheckSpec): Promise<ModelCheckResult> => {
    const began = now();
    if (began - startedAt >= totalBudgetMs) return failure(spec, null, 0, 'skipped');

    const controller = new AbortController();
    // Never let a call outlive what is left of the total budget.
    const allowedMs = Math.max(1, Math.min(perCallTimeoutMs, totalBudgetMs - (began - startedAt)));
    const timer = setTimeout(() => controller.abort(), allowedMs);
    try {
      const outcome = await probe(spec, controller.signal);
      const latencyMs = Math.max(0, now() - began);
      if (outcome.status >= 200 && outcome.status < 300) {
        // A speech call that returns no audio did not really work.
        if (spec.feature === 'tts' && outcome.hasOutput === false) {
          return failure(spec, outcome.status, latencyMs, 'empty');
        }
        return { model: spec.model, feature: spec.feature, ok: true, status: outcome.status, latencyMs };
      }
      return failure(spec, outcome.status, latencyMs, outcome.errorStatus || `HTTP_${outcome.status}`);
    } catch {
      const latencyMs = Math.max(0, now() - began);
      return failure(spec, null, latencyMs, controller.signal.aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
  };

  const worker = async (): Promise<void> => {
    while (next < specs.length) {
      const index = next++;
      results[index] = await runOne(specs[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, specs.length) }, worker));
  return results;
};

export interface ModelCheckReport {
  checkedAt: string;
  passed: number;
  failed: number;
  results: ModelCheckResult[];
}

export const buildReport = (results: ModelCheckResult[], at: Date = new Date()): ModelCheckReport => {
  const passed = results.filter((r) => r.ok).length;
  return { checkedAt: at.toISOString(), passed, failed: results.length - passed, results };
};

// ── One run per minute per admin ─────────────────────────────────────────────

export const COOLDOWN_MS = 60_000;

const lastRunByUid = new Map<string, number>();

/**
 * Allows one run per `COOLDOWN_MS` for a signed-in user (per warm function
 * instance; the platform rate limit on the route is the other half).
 */
export const checkCooldown = (
  uid: string,
  now: number = Date.now()
): { allowed: boolean; retryAfterSeconds: number } => {
  const last = lastRunByUid.get(uid);
  if (last !== undefined && now - last < COOLDOWN_MS) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((last + COOLDOWN_MS - now) / 1000)) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
};

/** Records that a run has started, so the next one must wait `COOLDOWN_MS`. */
export const recordRun = (uid: string, now: number = Date.now()): void => {
  lastRunByUid.set(uid, now);
  // The map only ever holds admins, but keep it from growing without bound anyway.
  if (lastRunByUid.size > 50) {
    for (const [key, at] of lastRunByUid) if (now - at >= COOLDOWN_MS) lastRunByUid.delete(key);
  }
};

/** Test helper: forget every recorded run. */
export const resetCooldownForTests = (): void => lastRunByUid.clear();
