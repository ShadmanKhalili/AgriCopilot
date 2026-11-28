import type { Config } from '@netlify/functions';
import { authenticate } from './_shared/auth.ts';
import { enforceIpLimit, jsonResponse, methodNotAllowed } from './_shared/proxy-guard.ts';
import {
  buildReport,
  checkCooldown,
  createGeminiProbe,
  isAdminUser,
  recordRun,
  runModelChecks,
} from './_shared/model-check.ts';

/**
 * POST /api/ai-model-check (admin only).
 *
 * Makes a few tiny Gemini calls (each model, Google Search, speech) and says
 * which ones the project's key can use today. Signed-in Firebase ID token
 * required, and the account must be the administrator. One run a minute.
 *
 * The response lists, per check: model, feature, ok, status, latencyMs and,
 * on a failure, a short errorCode and a fixed message. It never carries the
 * API key or anything the provider wrote.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const IP_CALLS_PER_MINUTE = 10;

export default async (request: Request, _context?: unknown): Promise<Response> => {
  if (request.method !== 'POST') return methodNotAllowed('POST');

  const limited = enforceIpLimit(request, 'ai-model-check', IP_CALLS_PER_MINUTE);
  if (limited) return limited;

  const { user, reason } = await authenticate(request);
  if (!user) {
    return jsonResponse(
      401,
      { error: reason === 'missing_token' ? 'Sign in first.' : 'Your session has expired. Please sign in again.' },
      NO_STORE
    );
  }
  if (!isAdminUser(user)) {
    return jsonResponse(403, { error: 'Only the administrator can run this check.' }, NO_STORE);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, { error: 'AI service is not configured.' }, NO_STORE);
  }

  const cooldown = checkCooldown(user.uid);
  if (!cooldown.allowed) {
    return jsonResponse(
      429,
      { error: 'The check was run a moment ago. Please wait a minute.', retryAfterSeconds: cooldown.retryAfterSeconds },
      { ...NO_STORE, 'Retry-After': String(cooldown.retryAfterSeconds) }
    );
  }

  // The cooldown starts once the run starts, so a failed setup does not lock the admin out.
  recordRun(user.uid);
  try {
    const results = await runModelChecks(createGeminiProbe(apiKey));
    return jsonResponse(200, buildReport(results), NO_STORE);
  } catch {
    return jsonResponse(500, { error: 'The check could not be completed. Please try again.' }, NO_STORE);
  }
};

export const config: Config = {
  path: '/api/ai-model-check',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
