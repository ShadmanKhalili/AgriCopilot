/**
 * POST /api/area-report
 *
 * A signed-in farmer tells the server "a farmer here saw this problem" or
 * "a farmer here got this price". The server checks the report against the
 * app's own lists (places, crops, diseases), checks that a problem report
 * matches a diagnosis this farmer really ran in the last 14 days, and keeps
 * the per-farmer data in a private document. Only aggregates of 3 or more
 * farmers are published in `area_summaries` (see _shared/area-model.ts and
 * _shared/area-store.ts). When a problem reaches 3 different farmers, one
 * notification, built only from the app's own names, goes to the phones
 * subscribed in that area.
 *
 * The same handler serves the Express route in server.ts (local dev).
 */

import { authenticate } from './_shared/auth.ts';
import { cleanAreaReport } from './_shared/area-model.ts';
import { recordAreaReport } from './_shared/area-store.ts';
import { hasRecentDiagnosis } from './_shared/area-diagnosis.ts';
import { areaWarningMessage, validateAreaReport } from './_shared/area-validate.ts';
import { sendPushToArea } from './_shared/push-send.ts';
import {
  adminFetch,
  anonymousId,
  firestoreDocumentName,
  serviceAccountConfigured,
} from './_shared/service-account.ts';

const MAX_BODY_BYTES = 2048;
/** A new account cannot report for this long: bulk-made accounts must not fake "3 farmers". */
const MIN_ACCOUNT_AGE_MS = 60 * 60 * 1000;

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/** Today in Dhaka (UTC+6, no daylight saving), 'YYYY-MM-DD'. */
const dhakaToday = (now: Date = new Date()): string =>
  new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });
  if (!serviceAccountConfigured()) return jsonResponse(503, { error: 'not_configured' });

  const { user } = await authenticate(request);
  if (!user) return jsonResponse(401, { error: 'signed_out' });
  // Accounts anyone can create in bulk must not be able to fake a "3 farmers" warning.
  if (user.isGuest) return jsonResponse(403, { error: 'guest_account' });
  // When Google tells us the account's age, a brand-new account has to wait.
  if (typeof user.createdAtMs === 'number' && Date.now() - user.createdAtMs < MIN_ACCOUNT_AGE_MS) {
    return jsonResponse(403, { error: 'account_too_new' });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonResponse(400, { error: 'invalid' });
  }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return jsonResponse(413, { error: 'too_large' });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { error: 'invalid' });
  }
  const clean = cleanAreaReport(body);
  if (!clean) return jsonResponse(400, { error: 'invalid' });
  // Unknown place, crop or disease: refused. Everything below uses the checked values only.
  const validated = validateAreaReport(clean);
  if (!validated) return jsonResponse(400, { error: 'invalid' });
  const { report } = validated;

  // A problem report needs a diagnosis the farmer really ran, here, recently.
  if (report.kind === 'problem' && validated.disease) {
    try {
      const found = await hasRecentDiagnosis(
        { adminFetch },
        user.uid,
        validated.disease.key,
        report.district,
        report.upazila
      );
      if (!found) return jsonResponse(403, { error: 'no_recent_diagnosis' });
    } catch (error: any) {
      console.warn(`[area-report] could not check the diagnosis: ${String(error?.message || 'unknown')}`);
      return jsonResponse(502, { error: 'store_failed' });
    }
  }

  let result;
  try {
    result = await recordAreaReport(
      { adminFetch, anonymousId, documentName: firestoreDocumentName, today: dhakaToday() },
      report,
      user.uid
    );
  } catch (error: any) {
    // The message carries only a status code, never a uid or token.
    console.warn(`[area-report] could not store a report: ${String(error?.message || 'unknown')}`);
    return jsonResponse(502, { error: 'store_failed' });
  }

  if (result.status === 'limited') return jsonResponse(429, { error: 'daily_limit' });

  if (result.status === 'stored' && result.crossedThreshold && report.kind === 'problem') {
    try {
      await sendPushToArea(report.areaKey, areaWarningMessage(validated, result.farmers));
    } catch {
      // A failed notification must never fail the report.
    }
  }

  return jsonResponse(200, { ok: true });
};
