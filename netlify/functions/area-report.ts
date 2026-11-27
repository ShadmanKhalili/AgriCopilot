/**
 * POST /api/area-report
 *
 * A signed-in farmer tells the server "a farmer here saw this problem" or
 * "a farmer here got this price". The server keeps only anonymous counts in
 * `area_summaries` (see _shared/area-model.ts and _shared/area-store.ts) and,
 * when a problem reaches 3 different farmers, sends one notification to the
 * phones subscribed in that area.
 *
 * The same handler serves the Express route in server.ts (local dev).
 */

import { authenticate } from './_shared/auth.ts';
import { cleanAreaReport, AREA_WINDOW_DAYS } from './_shared/area-model.ts';
import { recordAreaReport } from './_shared/area-store.ts';
import { sendPushToArea } from './_shared/push-send.ts';
import { adminFetch, anonymousId, serviceAccountConfigured } from './_shared/service-account.ts';

const MAX_BODY_BYTES = 2048;

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/** Today in Dhaka (UTC+6, no daylight saving), 'YYYY-MM-DD'. */
const dhakaToday = (now: Date = new Date()): string =>
  new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const bn = (value: number): string => String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
const words = (slug: string): string => slug.replace(/_/g, ' ').trim();

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });
  if (!serviceAccountConfigured()) return jsonResponse(503, { error: 'not_configured' });

  const { user } = await authenticate(request);
  if (!user) return jsonResponse(401, { error: 'signed_out' });
  // Accounts anyone can create in bulk must not be able to fake a "3 farmers" warning.
  if (user.isGuest) return jsonResponse(403, { error: 'guest_account' });

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
  const report = cleanAreaReport(body);
  if (!report) return jsonResponse(400, { error: 'invalid' });

  let result;
  try {
    result = await recordAreaReport({ adminFetch, anonymousId, today: dhakaToday() }, report, user.uid);
  } catch (error: any) {
    // The message carries only a status code, never a uid or token.
    console.warn(`[area-report] could not store a report: ${String(error?.message || 'unknown')}`);
    return jsonResponse(502, { error: 'store_failed' });
  }

  if (result.status === 'limited') return jsonResponse(429, { error: 'daily_limit' });

  if (result.status === 'stored' && result.crossedThreshold && report.kind === 'problem') {
    try {
      const crop = words(report.crop);
      const disease = words(report.diseaseKey ?? '');
      await sendPushToArea(report.areaKey, {
        titleBn: 'আপনার এলাকায় ফসলের সতর্কতা',
        titleEn: 'Crop warning in your area',
        bodyBn: `আপনার এলাকায় গত ${bn(AREA_WINDOW_DAYS)} দিনে ${bn(result.farmers)} জন কৃষক ${crop} ফসলে ${disease} জানিয়েছেন।`,
        bodyEn: `Your area: ${result.farmers} farmers reported ${disease} on ${crop} in the last ${AREA_WINDOW_DAYS} days.`,
        url: '/#community-radar',
        tag: `area-${report.groupKey}`,
      });
    } catch {
      // A failed notification must never fail the report.
    }
  }

  return jsonResponse(200, { ok: true });
};
