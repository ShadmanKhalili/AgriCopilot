/**
 * The generation settings a caller of the AI proxy may choose.
 *
 * Both proxies (the Netlify function and the Express dev server) used to
 * forward the caller's whole `config` object to Gemini. The output-token cap
 * and the safety settings were overwritten, but everything else went
 * through, so a signed-in caller could ask for `candidateCount: 8` (eight
 * answers, billed eight times, counted as one call against the daily
 * allowance) or an unbounded thinking budget. Only the settings the app
 * actually sends are kept now; tools and safety settings stay the server's
 * decision and are added by the caller of this module.
 */

const ALLOWED_CONFIG_KEYS = [
  'systemInstruction',
  'temperature',
  'topP',
  'topK',
  'stopSequences',
  'responseMimeType',
  'responseSchema',
  'responseModalities',
  'speechConfig',
  'mediaResolution',
] as const;

const THINKING_LEVELS = new Set(['minimal', 'low', 'medium', 'high']);

/**
 * The most output tokens one call may produce, from `AI_MAX_OUTPUT_TOKENS`
 * (default 8192, between 256 and 16384).
 */
export const maxOutputTokensFromEnv = (): number => {
  const value = Number(process.env.AI_MAX_OUTPUT_TOKENS);
  if (!Number.isFinite(value)) return 8192;
  return Math.min(16384, Math.max(256, Math.trunc(value)));
};

/**
 * Keep only the allowed settings from a caller's config, cap the output
 * tokens, and cap the thinking budget at the same ceiling.
 */
export const sanitizeGenerationConfig = (
  raw: unknown,
  maxOutputTokens: number
): Record<string, unknown> => {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const config: Record<string, unknown> = {};
  for (const key of ALLOWED_CONFIG_KEYS) {
    if (source[key] !== undefined) config[key] = source[key];
  }

  config.maxOutputTokens = Math.min(
    Math.max(Number(source.maxOutputTokens) || maxOutputTokens, 256),
    maxOutputTokens
  );

  const thinking = source.thinkingConfig as Record<string, unknown> | undefined;
  if (thinking && typeof thinking === 'object') {
    const capped: Record<string, unknown> = {};
    const budget = Number(thinking.thinkingBudget);
    if (thinking.thinkingBudget !== undefined && Number.isFinite(budget)) {
      // -1 asks for a dynamic, unbounded budget; give it the output cap instead.
      capped.thinkingBudget = budget < 0 ? maxOutputTokens : Math.min(Math.trunc(budget), maxOutputTokens);
    }
    if (typeof thinking.thinkingLevel === 'string' && THINKING_LEVELS.has(thinking.thinkingLevel.toLowerCase())) {
      capped.thinkingLevel = thinking.thinkingLevel;
    }
    if (Object.keys(capped).length > 0) config.thinkingConfig = capped;
  }

  return config;
};

/** Largest system instruction and response schema together, in characters. */
export const MAX_CONFIG_TEXT_CHARS = 20_000;

/**
 * Text in the settings is billed like the prompt but isn't part of `contents`,
 * so it needs its own limit.
 */
export const configTextChars = (config: Record<string, unknown>): number => {
  const size = (value: unknown): number => {
    if (value === undefined || value === null) return 0;
    return typeof value === 'string' ? value.length : JSON.stringify(value).length;
  };
  return size(config.systemInstruction) + size(config.responseSchema);
};

const MAX_CONTENT_DEPTH = 8;
const ALLOWED_PART_KEYS = new Set(['role', 'parts', 'text', 'inlineData']);

/**
 * Returns what's wrong with a request's content, or null if it's fine.
 *
 * The app only sends text and inline images. Anything else, such as `fileData`
 * pointing at a remote video or PDF, could be billed for millions of tokens while
 * the size limits see nothing, so it's refused rather than measured.
 */
export const findUnsupportedContent = (contents: unknown): string | null => {
  const visit = (node: unknown, depth: number): string | null => {
    if (depth > MAX_CONTENT_DEPTH) return 'nested too deeply';
    if (typeof node === 'string') return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const problem = visit(item, depth + 1);
        if (problem) return problem;
      }
      return null;
    }
    if (!node || typeof node !== 'object') return 'not text or an image';
    const part = node as Record<string, any>;
    for (const key of Object.keys(part)) {
      if (!ALLOWED_PART_KEYS.has(key)) return `"${key}" is not allowed`;
    }
    if (part.inlineData !== undefined) {
      const mimeType = String(part.inlineData?.mimeType || '');
      if (!/^(image|audio)\//.test(mimeType)) return 'only images and audio can be attached';
    }
    return part.parts === undefined ? null : visit(part.parts, depth + 1);
  };
  return visit(contents, 0);
};
