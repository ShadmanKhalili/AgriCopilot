/**
 * POST /api/farm-record-score
 *
 * Calculates a signed-in farmer's record score on the server, from their own
 * plots, seasons, costs, sales and crop checks (see _shared/record-facts.ts and
 * _shared/farm-record-model.ts), and stores it in `farm_record_scores/{uid}`,
 * which no browser may write. The browser then reads its own score document.
 *
 * Answers:
 *   200 {score}                       calculated and stored
 *   429 {error:'too_soon', score?}    calculated less than RECORD_SCORE_MIN_INTERVAL_MIN minutes ago
 *   401 signed out, 403 guest account, 503 server not set up, 502 database refused
 *
 * The same handler serves the Express route in server.ts (local dev).
 */

import { authenticate } from './_shared/auth.ts';
import {
  RECORD_SCORE_MIN_INTERVAL_MIN,
  RECORD_SCORE_VERSION,
  scoreFarmRecord,
  type StoredRecordScore,
} from './_shared/farm-record-model.ts';
import { gatherFarmRecordFacts } from './_shared/record-facts.ts';
import {
  adminFetch,
  fromFirestoreDocument,
  serviceAccountConfigured,
  toFirestoreValue,
} from './_shared/service-account.ts';

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const SCORE_COLLECTION = '/documents/farm_record_scores';

/** A stored score document as a StoredRecordScore, or null when it is not shaped like one. */
const asStoredScore = (data: Record<string, unknown>): StoredRecordScore | null => {
  if (
    typeof data.uid !== 'string' ||
    typeof data.score !== 'number' ||
    typeof data.level !== 'string' ||
    !Array.isArray(data.pillars) ||
    !data.facts ||
    typeof data.facts !== 'object' ||
    typeof data.computedAt !== 'string' ||
    typeof data.version !== 'number'
  ) {
    return null;
  }
  return data as unknown as StoredRecordScore;
};

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });
  if (!serviceAccountConfigured()) return jsonResponse(503, { error: 'not_configured' });

  const { user } = await authenticate(request);
  if (!user) return jsonResponse(401, { error: 'signed_out' });
  if (user.isGuest) return jsonResponse(403, { error: 'guest_account' });

  const uid = user.uid;
  const now = new Date();
  const scorePath = `${SCORE_COLLECTION}/${encodeURIComponent(uid)}`;

  try {
    // 1. Not again within the interval (the same score is returned instead).
    const existingResponse = await adminFetch(scorePath);
    if (existingResponse.status !== 404) {
      if (!existingResponse.ok) throw new Error(`record_score_read_${existingResponse.status}`);
      const existing = asStoredScore(fromFirestoreDocument(await existingResponse.json()));
      if (existing && existing.version === RECORD_SCORE_VERSION) {
        const ageMs = now.getTime() - Date.parse(existing.computedAt);
        // A computedAt in the future (clock drift) counts as "just now".
        if (Number.isFinite(ageMs) && ageMs < RECORD_SCORE_MIN_INTERVAL_MIN * 60_000) {
          return jsonResponse(429, { error: 'too_soon', score: existing });
        }
      }
    }

    // 2. Count, score, store.
    const facts = await gatherFarmRecordFacts({ adminFetch }, uid, now);
    const result = scoreFarmRecord(facts);
    const stored: StoredRecordScore = {
      uid,
      score: result.score,
      level: result.level,
      pillars: result.pillars,
      facts,
      computedAt: now.toISOString(),
      version: RECORD_SCORE_VERSION,
    };
    const writeResponse = await adminFetch(scorePath, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: Object.fromEntries(Object.entries(stored).map(([key, value]) => [key, toFirestoreValue(value)])),
      }),
    });
    if (!writeResponse.ok) throw new Error(`record_score_write_${writeResponse.status}`);

    return jsonResponse(200, { score: stored });
  } catch (error: any) {
    // Only our own "step_status" messages are logged, never anything that could carry a uid or token.
    const message = String(error?.message || '');
    console.warn(`[farm-record-score] could not calculate: ${/^[a-z_]+_\d{3}$/.test(message) ? message : 'unknown'}`);
    return jsonResponse(502, { error: 'store_failed' });
  }
};
