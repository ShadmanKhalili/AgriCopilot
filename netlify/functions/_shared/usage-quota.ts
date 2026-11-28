/**
 * Server-owned AI usage quota.
 *
 * The browser used to be the only place a daily allowance was counted, and
 * that counter lived in the user's own Firestore profile — which the user can
 * rewrite. A quota that the customer can reset is not a quota.
 *
 * This module keeps the counter on the server instead, using the caller's own
 * Firebase ID token so no Admin SDK / service account is needed:
 *
 *   users/{uid}/aiUsage/{eventId}
 *
 * Each event carries the day it belongs to as a `YYYYMMDD` number. The
 * Firestore rules compare it against `request.time` — the server clock — so
 * the day cannot be forged, rolled back or rolled forward. The event
 * documents are create-only and cannot be updated or deleted, so the count
 * only ever goes up. A caller can therefore only ever make their own
 * allowance smaller.
 *
 * The count is read with a `runQuery` on the day's events, filtered to this
 * account. The Firestore REST `documents.list` endpoint cannot reach a
 * collection that lives under a document, so `runQuery` is used instead.
 */

import { adminFetch, firestoreDocumentName, serviceAccountConfigured } from './service-account.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'studio-1309545077-89018';
const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-48b5516c-2b1e-4742-b49f-c9c3397058d0';

const DOCUMENTS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const FIRESTORE_TIMEOUT_MS = 8000;
/** A day cannot hold more than this many calls, so one query page is enough. */
const MAX_EVENTS_PER_DAY = 1000;

/** The collection that holds one account's usage events. */
const eventsCollection = (uid: string) =>
  `${DOCUMENTS_BASE}/users/${encodeURIComponent(uid)}/aiUsage`;

const bearer = (idToken: string) => ({ Authorization: `Bearer ${idToken}` });

/**
 * What one usage event paid for. `live` is one minted Live API session token
 * (live video / voice), which costs far more than a single text answer.
 */
export type AiUsageKind = 'text' | 'audio' | 'live';

const limitFromEnv = (raw: string | undefined, fallback: number): number => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_EVENTS_PER_DAY, Math.max(1, Math.trunc(value)));
};

/**
 * `guest` is an account that costs nothing to create (see `isGuestAccount`).
 * Anyone can make many of them, so each gets a small allowance; linking Google
 * or verifying an email address moves the same account up to `free`.
 */
export type AiPlan = 'guest' | 'free' | 'premium';

/**
 * AI calls an account may make per day, of every kind together
 * (`AI_GUEST_DAILY_LIMIT`, default 10; `AI_FREE_DAILY_LIMIT`, default 100;
 * `AI_PREMIUM_DAILY_LIMIT`, default 1000).
 */
export const dailyAiLimit = (plan: AiPlan): number =>
  plan === 'premium'
    ? limitFromEnv(process.env.AI_PREMIUM_DAILY_LIMIT, 1000)
    : plan === 'guest'
      ? limitFromEnv(process.env.AI_GUEST_DAILY_LIMIT, 10)
      : limitFromEnv(process.env.AI_FREE_DAILY_LIMIT, 100);

/** What a caller sees when today's allowance is spent. */
export const dailyLimitMessage = (plan: AiPlan): string =>
  plan === 'premium'
    ? 'You have reached your daily AI limit. It resets tomorrow.'
    : plan === 'guest'
      ? `Guest accounts get ${dailyAiLimit('guest')} AI answers a day. Link Google in your profile for ${dailyAiLimit('free')} a day, or try again tomorrow.`
      : "You have used all of today's free AI advice. It resets tomorrow.";

/**
 * Live sessions an account may start per day, on top of the overall limit
 * (`AI_GUEST_DAILY_LIVE_SESSIONS`, default 1; `AI_FREE_DAILY_LIVE_SESSIONS`,
 * default 20; `AI_PREMIUM_DAILY_LIVE_SESSIONS`, default 200).
 */
export const dailyLiveSessionLimit = (plan: AiPlan): number =>
  plan === 'premium'
    ? limitFromEnv(process.env.AI_PREMIUM_DAILY_LIVE_SESSIONS, 200)
    : plan === 'guest'
      ? limitFromEnv(process.env.AI_GUEST_DAILY_LIVE_SESSIONS, 1)
      : limitFromEnv(process.env.AI_FREE_DAILY_LIVE_SESSIONS, 20);

/**
 * The current UTC day as `YYYYMMDD`.
 *
 * UTC on purpose: the Firestore rules derive the same value from
 * `request.time`, which is also UTC. Using a local timezone here would make
 * every write before 06:00 local time fail the rule.
 */
export const utcDayKey = (when: Date = new Date()): string => {
  const year = when.getUTCFullYear();
  const month = String(when.getUTCMonth() + 1).padStart(2, '0');
  const day = String(when.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

/** The same day as the number the Firestore rules compute. */
export const utcDayNumber = (when: Date = new Date()): number =>
  when.getUTCFullYear() * 10000 + (when.getUTCMonth() + 1) * 100 + when.getUTCDate();

const randomEventId = (): string => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * How many AI calls this account has already made today — of one `kind`
 * when given, otherwise of every kind.
 * Returns `null` when the count could not be read — the caller then fails
 * closed rather than handing out free AI.
 */
export const countAiUsageToday = async (
  uid: string,
  idToken: string,
  dayNumber: number,
  kind?: AiUsageKind
): Promise<number | null> => {
  try {
    const filters: unknown[] = [
      {
        fieldFilter: {
          field: { fieldPath: 'uid' },
          op: 'EQUAL',
          value: { stringValue: uid },
        },
      },
      {
        fieldFilter: {
          field: { fieldPath: 'day' },
          op: 'EQUAL',
          value: { integerValue: String(dayNumber) },
        },
      },
    ];
    if (kind) {
      filters.push({
        fieldFilter: {
          field: { fieldPath: 'kind' },
          op: 'EQUAL',
          value: { stringValue: kind },
        },
      });
    }
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'aiUsage' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters,
          },
        },
        limit: MAX_EVENTS_PER_DAY,
      },
    };
    const response = await fetch(`${DOCUMENTS_BASE}/users/${encodeURIComponent(uid)}:runQuery`, {
      method: 'POST',
      headers: { ...bearer(idToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FIRESTORE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const raw = await response.text();
    let rows: unknown[] = [];
    try {
      const parsed = JSON.parse(raw);
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // The endpoint can stream newline-delimited objects.
      rows = raw.split('\n').filter((line) => line.trim().length > 0);
    }
    // Rows that carry no document are metadata (e.g. an explain-metrics row).
    return rows.filter((row: any) => row && row.document).length;
  } catch {
    return null;
  }
};

/**
 * Record one AI call against today's allowance. Returns whether the event was
 * stored, and never throws. Callers record before spending anything and refuse
 * the call when this returns false, so a failed write can't mean a free call.
 */
export const recordAiUsage = async (
  uid: string,
  idToken: string,
  dayNumber: number,
  kind: AiUsageKind
): Promise<boolean> => {
  try {
    const eventId = randomEventId();
    const url = `${eventsCollection(uid)}?documentId=${eventId}`;
    const body = {
      fields: {
        uid: { stringValue: uid },
        day: { integerValue: String(dayNumber) },
        kind: { stringValue: kind },
        at: { integerValue: String(Date.now()) },
      },
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...bearer(idToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FIRESTORE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    // See the doc comment: report, never throw.
    return false;
  }
};

// ── Global daily spend cut-off ──────────────────────────────────────────────
//
// The per-account allowance cannot stop a crowd of free accounts from draining
// the paid Gemini key. This is the last wall: one counter for the whole app,
//
//   aiUsageGlobal/{YYYY-MM-DD}      (day in Asia/Dhaka, UTC+6)
//     calls: total charged calls     textCalls / audioCalls / liveCalls
//
// written with the service account (clients cannot touch it; Firestore's
// default-deny covers the collection) and incremented atomically with a
// `documents:commit` field transform, so parallel instances never lose a count.
//
// Off unless AI_GLOBAL_DAILY_CALL_CAP is set to a positive number.

/** The error code the AI endpoints answer (HTTP 503) when the cap is reached. */
export const DAILY_CAPACITY_ERROR = 'daily_capacity';

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** The cap on charged AI calls per Dhaka day, or null when none is set. */
export const globalDailyCallCap = (): number | null => {
  const raw = (process.env.AI_GLOBAL_DAILY_CALL_CAP || '').trim();
  if (!raw) return null;
  const value = Math.trunc(Number(raw));
  return Number.isFinite(value) && value > 0 ? value : null;
};

/** The current Asia/Dhaka calendar day as `YYYY-MM-DD` (Bangladesh has no DST). */
export const dhakaDayKey = (when: Date = new Date()): string =>
  new Date(when.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);

export type GlobalChargeResult =
  | { ok: true; enabled: boolean; count?: number; cap?: number }
  | { ok: false; reason: typeof DAILY_CAPACITY_ERROR; count: number; cap: number };

/** Dhaka day for which this instance already saw the cap reached. */
let exhaustedDay: string | null = null;

/** Test hook: forget the "cap reached" memory. */
export const __resetGlobalCapMemoryForTests = (): void => {
  exhaustedDay = null;
};

/**
 * Charge `weight` calls (default 1) of `kind` against the app-wide daily cap.
 *
 * - No cap set: returns `{ ok: true, enabled: false }` and makes no request.
 * - Under the cap: `{ ok: true, enabled: true, count, cap }`.
 * - Over the cap: `{ ok: false, reason: 'daily_capacity' }`. The caller answers
 *   503 `{ error: 'daily_capacity' }` and does not spend anything.
 *
 * Fails OPEN when the counter cannot be reached (no service account, Firestore
 * down): this wall is a spend backstop, the per-account allowance still
 * applies, and an outage here must not take the whole app down. The failure
 * is logged. Never throws.
 *
 * The AI proxy calls this for every text / audio call, and the Live token
 * function can call it with `'live'` for every minted session.
 */
export const chargeGlobalAiCall = async (
  kind: AiUsageKind,
  weight = 1,
  when: Date = new Date()
): Promise<GlobalChargeResult> => {
  const cap = globalDailyCallCap();
  if (cap === null) return { ok: true, enabled: false };

  const day = dhakaDayKey(when);
  if (exhaustedDay === day) {
    // Already known to be over the cap today on this instance: skip the write.
    return { ok: false, reason: DAILY_CAPACITY_ERROR, count: cap, cap };
  }

  const step = String(Math.max(1, Math.trunc(weight) || 1));
  try {
    if (!serviceAccountConfigured()) {
      console.warn('[usage-quota] AI_GLOBAL_DAILY_CALL_CAP is set but no service account is configured; cap not enforced.');
      return { ok: true, enabled: false };
    }
    const increment = { integerValue: step };
    const response = await adminFetch('/documents:commit', {
      method: 'POST',
      body: JSON.stringify({
        writes: [
          {
            // Empty update + empty mask: create the day's document if it is
            // missing and leave existing fields alone; only the transforms act.
            update: { name: firestoreDocumentName(`aiUsageGlobal/${day}`), fields: {} },
            updateMask: { fieldPaths: [] },
            updateTransforms: [
              { fieldPath: 'calls', increment },
              { fieldPath: `${kind}Calls`, increment },
              { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      console.warn(`[usage-quota] global counter commit failed (${response.status}); cap not enforced for this call.`);
      return { ok: true, enabled: false };
    }
    const data: any = await response.json();
    const count = Number(data?.writeResults?.[0]?.transformResults?.[0]?.integerValue);
    if (!Number.isFinite(count)) {
      console.warn('[usage-quota] global counter commit returned no count; cap not enforced for this call.');
      return { ok: true, enabled: false };
    }
    if (count > cap) {
      exhaustedDay = day;
      return { ok: false, reason: DAILY_CAPACITY_ERROR, count, cap };
    }
    return { ok: true, enabled: true, count, cap };
  } catch (error) {
    console.warn('[usage-quota] global counter unavailable; cap not enforced for this call.', (error as Error)?.message);
    return { ok: true, enabled: false };
  }
};

/**
 * The account's plan. Premium is stored on the profile and only an admin can
 * set it, so it wins. Otherwise a guest account (`isGuest` from the verified
 * token) gets the guest allowance, and everyone else the free one. A profile
 * that cannot be read is treated as not premium.
 */
export const getUserPlan = async (
  uid: string,
  idToken: string,
  isGuest: boolean
): Promise<AiPlan> => {
  const fallback: AiPlan = isGuest ? 'guest' : 'free';
  try {
    const response = await fetch(`${DOCUMENTS_BASE}/users/${encodeURIComponent(uid)}`, {
      headers: bearer(idToken),
      signal: AbortSignal.timeout(FIRESTORE_TIMEOUT_MS),
    });
    if (!response.ok) return fallback;
    const data: any = await response.json();
    const tier = data?.fields?.tier?.stringValue;
    return tier === 'premium' ? 'premium' : fallback;
  } catch {
    return fallback;
  }
};
