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
 * How many AI calls this account has already made today.
 * Returns `null` when the count could not be read — the caller then fails
 * closed rather than handing out free AI.
 */
export const countAiUsageToday = async (
  uid: string,
  idToken: string,
  dayNumber: number
): Promise<number | null> => {
  try {
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'aiUsage' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
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
            ],
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
 * Record one successful AI call against today's allowance.
 * Failures are swallowed: an unwritable counter must not break the farmer's
 * request that already produced an answer.
 */
export const recordAiUsage = async (
  uid: string,
  idToken: string,
  dayNumber: number,
  kind: 'text' | 'audio'
): Promise<void> => {
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
    await fetch(url, {
      method: 'POST',
      headers: { ...bearer(idToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FIRESTORE_TIMEOUT_MS),
    });
  } catch {
    // Ignore — see the doc comment.
  }
};

/**
 * The account's plan, as stored on the profile. Premium accounts get a larger
 * allowance. A profile that cannot be read is treated as free.
 */
export const getUserPlan = async (
  uid: string,
  idToken: string
): Promise<'free' | 'premium'> => {
  try {
    const response = await fetch(`${DOCUMENTS_BASE}/users/${encodeURIComponent(uid)}`, {
      headers: bearer(idToken),
      signal: AbortSignal.timeout(FIRESTORE_TIMEOUT_MS),
    });
    if (!response.ok) return 'free';
    const data: any = await response.json();
    const tier = data?.fields?.tier?.stringValue;
    return tier === 'premium' ? 'premium' : 'free';
  } catch {
    return 'free';
  }
};
