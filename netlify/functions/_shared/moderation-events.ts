/**
 * Append-only moderation ledger.
 *
 * When the upstream refuses a request, the refusal itself is the signal worth
 * keeping: a farmer repeatedly tripping a content filter is exactly the
 * pattern an abuse review needs to see. Today the proxy simply logged a
 * warning string and moved on, so there was no record to review and no way to
 * tell a one-off accident from a pattern.
 *
 * ── What is recorded, and what is deliberately not ───────────────────────────
 * Recorded: who, when, which surface, why, which model, how serious.
 *
 * NOT recorded: the prompt text, the image bytes, the answer, the farmer's
 * name, their location, their device, their IP. A moderation event must be
 * able to answer "did this account trip a filter?" without becoming a second
 * copy of everything the farmer ever typed or photographed. The upstream
 * reason and category are a small closed vocabulary, so this is metadata
 * about an event, not a transcript of it.
 *
 * ── Where it lives, and why ──────────────────────────────────────────────────
 *   users/{uid}/moderationEvents/{eventId}
 *
 * The same shape as the AI usage ledger, for the same reason: the write is
 * made with the caller's own Firebase ID token, so no Admin SDK or service
 * account is needed, and the Firestore rules can prove the caller is writing
 * into their own subtree. Events are create-only and can never be updated or
 * deleted, so the ledger cannot be rewritten — not by the farmer, and not by
 * an administrator. The day is stamped by the server clock and compared
 * against `request.time` in the rules, so it cannot be forged either.
 *
 * Only the account holder and an administrator can read these events.
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'studio-1309545077-89018';
const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-48b5516c-2b1e-4742-b49f-c9c3397058d0';

const DOCUMENTS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const FIRESTORE_TIMEOUT_MS = 8000;

/** Which part of the app the blocked request came from. */
export type ModerationSurface = 'text' | 'audio';

/** How serious the block was, derived from the upstream reason. */
export type ModerationSeverity = 'low' | 'medium' | 'high';

const eventsCollection = (uid: string) =>
  `${DOCUMENTS_BASE}/users/${encodeURIComponent(uid)}/moderationEvents`;

const bearer = (idToken: string) => ({ Authorization: `Bearer ${idToken}` });

const randomEventId = (): string => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export interface ModerationEvent {
  surface: ModerationSurface;
  /** The upstream block reason, e.g. `SAFETY`, `PROHIBITED_CONTENT`. */
  reason: string;
  /** The harm category that tripped, when the upstream named one. */
  category?: string | null;
  /** The model that refused the request. */
  model: string;
  severity: ModerationSeverity;
}

/**
 * Record one safety refusal against today's ledger.
 *
 * Failures are swallowed: an unwritable ledger must not turn a refusal into a
 * confusing crash for a farmer whose request was simply blocked. The refusal
 * itself is still returned to the caller either way.
 */
export const recordModerationEvent = async (
  uid: string,
  idToken: string,
  dayNumber: number,
  event: ModerationEvent
): Promise<void> => {
  try {
    const eventId = randomEventId();
    const url = `${eventsCollection(uid)}?documentId=${eventId}`;
    const fields: Record<string, unknown> = {
      uid: { stringValue: uid },
      day: { integerValue: String(dayNumber) },
      surface: { stringValue: event.surface },
      reason: { stringValue: String(event.reason || 'SAFETY').slice(0, 64) },
      model: { stringValue: String(event.model || 'unknown').slice(0, 64) },
      severity: { stringValue: event.severity },
      at: { integerValue: String(Date.now()) },
    };
    // The category is optional, so it is only added when the upstream named
    // one. The Firestore rule allows the key to be present or absent.
    if (event.category) {
      fields.category = { stringValue: String(event.category).slice(0, 64) };
    }

    await fetch(url, {
      method: 'POST',
      headers: { ...bearer(idToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      signal: AbortSignal.timeout(FIRESTORE_TIMEOUT_MS),
    });
  } catch {
    // Ignore — see the doc comment.
  }
};
