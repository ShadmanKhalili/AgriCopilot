/**
 * Server-owned safety policy for the AI proxy.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Until now the proxy deleted the caller's `safetySettings` and forwarded the
 * request with none:
 *
 *     delete config.safetySettings;
 *
 * That is not "no safety" — Gemini still applies the model's own built-in
 * safety. But it means the *application* owned no filter layer at all: there
 * was no explicit, auditable, server-side rule that a sexually explicit photo,
 * a harassment prompt or a jailbreak attempt would be refused. The threshold
 * and the category list were implicit in the model, not in our code.
 *
 * This module makes that layer explicit and owned by the server. The caller
 * cannot raise or lower it, cannot add a category, and cannot remove one.
 *
 * ── Which categories, and why these ──────────────────────────────────────────
 * The Gemini Developer API supports exactly six harm categories:
 *
 *   HATE_SPEECH, SEXUALLY_EXPLICIT, DANGEROUS_CONTENT, HARASSMENT,
 *   CIVIC_INTEGRITY, JAILBREAK
 *
 * Deliberately NOT used:
 *
 *   - `HARM_CATEGORY_IMAGE_*` — the SDK ships these enum values but its own
 *     doc comment says "This enum value is not supported in Gemini API".
 *     Sending one is a guaranteed 400. The text categories already apply to
 *     image input, because `safetySettings` are enforced against
 *     `GenerateContentRequest.contents` as well as against `candidates`.
 *   - `HARM_CATEGORY_CIVIC_INTEGRITY` — the SDK marks it deprecated.
 *   - `method` — the API reference says "This field is not supported in
 *     Gemini API", so we never set it.
 *
 * `HARM_CATEGORY_JAILBREAK` is included but guarded: the SDK comment says it
 * is "not supported in Gemini API" while the current guide lists it as
 * adjustable. Rather than trust either, the proxy detects a rejection that
 * names the category and retries once without it, then remembers that for the
 * life of the function instance.
 *
 * ── Thresholds ───────────────────────────────────────────────────────────────
 * `BLOCK_LOW_AND_ABOVE` is the strictest setting Gemini offers. For a
 * farming advice app serving rural users who may photograph crops in a hurry,
 * a false positive (an over-strict filter refusing a legitimate leaf photo) is
 * a worse failure than a false negative: the farmer gets nothing at all.
 * `BLOCK_NONE` would leave the application with no filter layer. We keep the
 * strict setting and rely on the retry-and-degrade path plus a clear message
 * to the farmer rather than by quietly weakening the policy.
 */

export interface SafetySetting {
  category: string;
  threshold: string;
}

/** The jailbreak category, isolated so it can be dropped on a 400. */
export const JAILBREAK_CATEGORY = 'HARM_CATEGORY_JAILBREAK';

/**
 * The server's safety policy. Applied to every GenerateContent call — the
 * text path and the audio path share one `config` object, so a single
 * assignment covers both.
 */
export const SERVER_SAFETY_SETTINGS: SafetySetting[] = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: JAILBREAK_CATEGORY, threshold: 'BLOCK_LOW_AND_ABOVE' },
];

/** The same policy with the jailbreak category removed. */
export const SERVER_SAFETY_SETTINGS_WITHOUT_JAILBREAK: SafetySetting[] =
  SERVER_SAFETY_SETTINGS.filter((setting) => setting.category !== JAILBREAK_CATEGORY);

/** The machine-readable code the client uses to recognise a safety refusal. */
export const SAFETY_BLOCK_CODE = 'SAFETY_BLOCK';

/**
 * The default (English) refusal. The client replaces it with a localised
 * message when it recognises `SAFETY_BLOCK`; this string is the fallback for
 * any client that does not, and it is deliberately vague about *which* filter
 * tripped so the answer cannot be used to probe for a bypass.
 */
export const SAFETY_BLOCK_MESSAGE =
  'This request was blocked by our safety policy. Please share a clear photo of the affected crop and try again.';

/**
 * Block reasons that mean "the upstream refused this content".
 *
 * `BlockReason` (prompt side) and `FinishReason` (output side) share most of
 * these names but not all of them, so one set covers both.
 */
export const SAFETY_BLOCK_REASONS = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
]);

/** How serious a given block reason is, for the moderation ledger. */
const SEVERITY_BY_REASON: Record<string, 'low' | 'medium' | 'high'> = {
  SAFETY: 'medium',
  BLOCKLIST: 'medium',
  PROHIBITED_CONTENT: 'high',
  IMAGE_SAFETY: 'high',
  IMAGE_PROHIBITED_CONTENT: 'high',
  SPII: 'high',
  JAILBREAK: 'medium',
};

/**
 * The upstream `error.code` values that mean a safety refusal rather than a
 * generic failure. A blocked GenerateContent call arrives as HTTP 400 with
 * one of these codes.
 */
const SAFETY_ERROR_CODES = new Set([
  'safety',
  'jailbreak',
  'prohibited_content',
  'blocklist',
  'spii',
  'image_safety',
]);

export interface SafetyBlock {
  /** Why the upstream refused. */
  reason: string;
  /** The harm category that tripped, when the upstream named one. */
  category: string | null;
  /** Severity for the moderation ledger. */
  severity: 'low' | 'medium' | 'high';
}

/**
 * True when a finish reason or block reason means the content was refused.
 */
export const isSafetyBlockReason = (reason: unknown): boolean =>
  typeof reason === 'string' && SAFETY_BLOCK_REASONS.has(reason.toUpperCase());

/**
 * Pull the harm category out of a candidate's safety ratings.
 *
 * The upstream reports one rating per category it evaluated. We record the
 * first one it rated HIGH or MEDIUM, because that is the category that
 * actually stopped the request.
 */
export const extractBlockedCategory = (candidate: any): string | null => {
  const ratings = candidate?.safetyRatings;
  if (!Array.isArray(ratings)) return null;
  const tripped = ratings.find(
    (rating: any) =>
      rating &&
      typeof rating.category === 'string' &&
      (String(rating.probability || '').toUpperCase() === 'HIGH' ||
        String(rating.probability || '').toUpperCase() === 'MEDIUM')
  );
  return tripped ? String(tripped.category) : null;
};

/**
 * Inspect one streamed chunk for a safety refusal.
 *
 * Both signals are checked because they arrive in different places:
 *   - `promptFeedback.blockReason` — the *prompt* was refused, so there is no
 *     candidate and no text at all;
 *   - `candidates[0].finishReason === 'SAFETY'` — generation stopped
 *     because the *output* tripped a filter. The chunk that carries the
 *     finish reason may also carry text that must never be shown.
 */
export const detectSafetyBlockInChunk = (chunk: any): SafetyBlock | null => {
  const promptReason = chunk?.promptFeedback?.blockReason;
  if (isSafetyBlockReason(promptReason)) {
    return {
      reason: String(promptReason).toUpperCase(),
      category: null,
      severity: SEVERITY_BY_REASON[String(promptReason).toUpperCase()] || 'medium',
    };
  }

  const candidate = chunk?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (isSafetyBlockReason(finishReason)) {
    const reason = String(finishReason).toUpperCase();
    return {
      reason,
      category: extractBlockedCategory(candidate),
      severity: SEVERITY_BY_REASON[reason] || 'medium',
    };
  }

  return null;
};

/**
 * Recognise a safety refusal that arrived as a thrown HTTP error rather than
 * as a chunk.
 *
 * With safety settings on, a blocked request comes back as HTTP 400 with
 * `error.code` set to one of the safety codes. The SDK wraps that in an
 * Error whose message carries the serialised body, so the code is looked for
 * in both places.
 */
export const detectSafetyBlockInError = (error: any): SafetyBlock | null => {
  if (!error) return null;

  const directCode = String(error?.code || error?.status || '').toLowerCase();
  if (SAFETY_ERROR_CODES.has(directCode)) {
    const reason = directCode.toUpperCase();
    return {
      reason,
      category: null,
      severity: SEVERITY_BY_REASON[reason] || 'medium',
    };
  }

  let text = '';
  try {
    text = `${error?.message || ''} ${JSON.stringify(error ?? {})}`.toLowerCase();
  } catch {
    text = String(error?.message || '').toLowerCase();
  }
  if (!text) return null;

  // The jailbreak category has its own code and is not a content block, so it
  // is handled separately (it triggers a retry without the category).
  for (const code of SAFETY_ERROR_CODES) {
    if (code === 'jailbreak') continue;
    if (text.includes(code)) {
      const reason = code.toUpperCase();
      return {
        reason,
        category: null,
        severity: SEVERITY_BY_REASON[reason] || 'medium',
      };
    }
  }

  return null;
};

/**
 * True when the upstream rejected the request specifically because of the
 * jailbreak harm category.
 *
 * This is the signal to retry the same request without that one category,
 * rather than to treat the call as a content block.
 */
export const isJailbreakCategoryRejection = (error: any): boolean => {
  if (!error) return false;

  const directCode = String(error?.code || '').toLowerCase();
  if (directCode === 'jailbreak') return true;

  let text = '';
  try {
    text = `${error?.message || ''} ${JSON.stringify(error ?? {})}`.toLowerCase();
  } catch {
    text = String(error?.message || '').toLowerCase();
  }
  if (!text) return false;

  // Require the category name itself so an unrelated 400 that merely says
  // "invalid argument" does not disable the category for the whole instance.
  return (
    text.includes('jailbreak') &&
    (text.includes('h harm_category_jailbreak') ||
      text.includes('harm_category_jailbreak') ||
      text.includes('jailbreak category') ||
      text.includes('"jailbreak"'))
  );
};

/**
 * Remove the jailbreak category from a config object, if it has one.
 */
export const withoutJailbreakCategory = (config: Record<string, unknown>): Record<string, unknown> => {
  const settings = config?.safetySettings;
  if (!Array.isArray(settings)) return config;
  const kept = settings.filter(
    (setting: any) => String(setting?.category || '').toUpperCase() !== JAILBREAK_CATEGORY
  );
  return { ...config, safetySettings: kept };
};

/** True when the config still carries the jailbreak category. */
export const hasJailbreakCategory = (config: Record<string, unknown>): boolean => {
  const settings = config?.safetySettings;
  if (!Array.isArray(settings)) return false;
  return settings.some(
    (setting: any) => String(setting?.category || '').toUpperCase() === JAILBREAK_CATEGORY
  );
};
