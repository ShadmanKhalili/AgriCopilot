import { GoogleGenAI } from "@google/genai";
import { authenticate } from "./_shared/auth.ts";
import { countAiUsageToday, getUserPlan, recordAiUsage, utcDayNumber } from "./_shared/usage-quota.ts";

/**
 * Netlify AI proxy.
 *
 * Text generation is streamed back as newline-delimited JSON. Streaming keeps
 * the connection alive through Netlify's function execution window while the
 * model is still thinking, and the server owns the failover cascade so a 503
 * from the primary model does not cost the browser another full round trip.
 *
 * Audio/TTS requests stay buffered because the client needs the inline audio
 * candidate, not a text stream.
 *
 * ── Launch hardening ────────────────────────────────────────────────────────
 * This endpoint used to be an open relay to a paid Gemini key: no
 * authentication, no quota, no rate limit, and the caller chose the model,
 * the output-token ceiling and the tool list. One crafted request could ask
 * for a million input tokens and 65 536 output tokens, and the function would
 * happily forward it.
 *
 * What changed:
 *   - every call must carry a valid Firebase ID token (a real account);
 *   - the model list is owned by the server, not the caller;
 *   - `maxOutputTokens` is clamped;
 *   - the request body, the total prompt text and the number of images are
 *     capped, so a single request can no longer be unbounded in cost;
 *   - the caller gets a per-day allowance that lives on the server and cannot
 *     be reset by editing your own profile;
 *   - upstream error text is no longer echoed back to the caller.
 */

// ── Server-owned configuration ──────────────────────────────────────────────
// The model list is a server decision. The client may ask for a model, but it
// only ever selects from this list. `gemini-3.8-flash` and `gemini-2.5-flash`
// are NOT in the default list: on the project's current key they answer
// "This model is no longer available to new users" (404), so every failure
// used to burn two extra pointless upstream calls before the real error.
const parseModelList = (raw: string | undefined, fallback: string[]): string[] => {
  const list = (raw || '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => /^gemini-[a-z0-9.\-]+$/i.test(m));
  return list.length ? Array.from(new Set(list)) : fallback;
};

const TEXT_MODELS = parseModelList(process.env.AI_TEXT_MODELS, [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
]);
const AUDIO_MODELS = parseModelList(process.env.AI_AUDIO_MODELS, [
  "gemini-3.8-flash-lite-tts",
  "gemini-3.8-flash-tts",
]);

const clampInt = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

/** Ceiling on the tokens the model may produce for one call. */
const MAX_OUTPUT_TOKENS = clampInt(process.env.AI_MAX_OUTPUT_TOKENS, 8192, 256, 16384);
/** Calls a free account may make per day. */
const FREE_DAILY_LIMIT = clampInt(process.env.AI_FREE_DAILY_LIMIT, 100, 1, 100000);
/** Calls a premium account may make per day. */
const PREMIUM_DAILY_LIMIT = clampInt(process.env.AI_PREMIUM_DAILY_LIMIT, 1000, 1, 100000);

/** Largest request body we will even parse. */
const MAX_REQUEST_BYTES = 512 * 1024;
/** Largest amount of prompt text across all turns of one request. */
const MAX_TOTAL_TEXT_CHARS = 40_000;
/** Largest number of images in one request. */
const MAX_INLINE_IMAGES = 4;

/**
 * Per-model time budget and the overall budget for one proxied request.
 *
 * Netlify kills a synchronous function that runs longer than the platform
 * ceiling; we observed a 504 "Inactivity Timeout" at ~30 s. The old budget of
 * 50 s sat above the platform limit, so the platform killed the function
 * mid-stream and the client saw a truncated response.
 */
const MODEL_TIMEOUT_MS = 10_000;
const STREAM_BUDGET_MS = 22_000;

/**
 * Google Search grounding.
 *
 * `auto` (default) sends the tool, and if the upstream rejects it the request
 * is retried once without it. The rejection is cached per function instance so
 * a key without grounding support stops paying for the failed attempt.
 */
const SEARCH_GROUNDING_MODE = (process.env.AI_SEARCH_GROUNDING || 'auto').toLowerCase();
let groundingDisabledForInstance = false;

const jsonResponse = (statusCode: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

/**
 * The caller's model choice is mapped onto the server's allow-list. An unknown
 * model falls back to the primary one instead of being forwarded.
 */
const resolveModel = (requested: unknown, isAudio: boolean): string => {
  const allowList = isAudio ? AUDIO_MODELS : TEXT_MODELS;
  const wanted = typeof requested === "string" ? requested.trim() : "";
  if (wanted && allowList.includes(wanted)) return wanted;
  return allowList[0];
};

const getCandidateModels = (requested: unknown, isAudio: boolean): string[] => {
  if (isAudio) return AUDIO_MODELS;
  const wanted = typeof requested === "string" ? requested.trim() : "";
  if (wanted === "gemini-3.8-flash") {
    return ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
  }
  if (wanted === "gemini-2.5-flash") {
    return ["gemini-2.5-flash", "gemini-3.5-flash-lite"];
  }
  if (wanted && TEXT_MODELS.includes(wanted)) {
    return [wanted, "gemini-3.5-flash-lite"];
  }
  return ["gemini-3.5-flash-lite"];
};

const errorMessage = (error: any): string => {
  const message = String(error?.message || error || "Unknown AI error");
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
};

/** True for errors that will not be fixed by changing the request shape. */
const isQuotaOrRateError = (error: any): boolean => {
  const text = `${error?.message || ""} ${JSON.stringify(error || {})}`.toLowerCase();
  return (
    text.includes("429") ||
    text.includes("resource_exhausted") ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("too many requests")
  );
};

/**
 * Only the Google Search tool may be requested, and only when the caller
 * actually asks for it. Anything else the caller puts in `tools` is dropped:
 * tool use is billed separately and some tools can run code or fetch URLs.
 */
const sanitizeTools = (tools: unknown): any[] | undefined => {
  if (!Array.isArray(tools)) return undefined;
  const allowed = tools.filter(
    (tool: any) =>
      tool && typeof tool === "object" && Object.keys(tool).length === 1 && "googleSearch" in tool
  );
  return allowed.length ? allowed : undefined;
};

/** Remove the grounding tool from a config object. */
const stripTools = (config: Record<string, unknown>): Record<string, unknown> => {
  const { tools, toolConfig, ...rest } = config;
  return rest;
};

/**
 * Walk the request and measure what it is really asking for. The old guard
 * only looked at `contents` when it was a *string*, but the Gemini contract
 * makes `contents` an array — so the 50 000-character limit never fired and a
 * single request could carry megabytes of base64 images.
 */
const measureContents = (contents: unknown): { textChars: number; images: number } => {
  let textChars = 0;
  let images = 0;
  const visit = (node: any, depth: number) => {
    if (!node || depth > 8) return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof node === "string") {
      textChars += node.length;
      return;
    }
    if (typeof node !== "object") return;
    if (typeof node.text === "string") textChars += node.text.length;
    if (node.inlineData) images += 1;
    if (node.parts) visit(node.parts, depth + 1);
  };
  visit(contents, 0);
  return { textChars, images };
};

type StreamOutcome =
  | { status: "ok"; text: string; model: string }
  | { status: "error"; error: string };

/**
 * One attempt against one model.
 * Returns the text on success, or the error that stopped it.
 */
const runModel = async (
  apiKey: string,
  model: string,
  contents: unknown,
  config: Record<string, unknown>,
  onChunk: (text: string) => void
): Promise<StreamOutcome> => {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), MODEL_TIMEOUT_MS);
  try {
    const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: MODEL_TIMEOUT_MS } });
    const responseStream = await client.models.generateContentStream({
      model,
      contents: contents as any,
      config: { ...config, abortSignal: abortController.signal },
    });

    let text = "";
    for await (const chunk of responseStream) {
      const piece = chunk.text || "";
      if (piece) {
        text += piece;
        onChunk(piece);
      }
    }
    if (text) {
      return { status: "ok", text, model };
    }
    return { status: "error", error: "The model returned an empty response." };
  } catch (error: any) {
    return { status: "error", error: errorMessage(error) };
  } finally {
    clearTimeout(timer);
  }
};

const streamText = async (
  apiKey: string,
  contents: unknown,
  config: Record<string, unknown>,
  requestedModel: string,
  requestedTools: any[] | undefined,
  quota: { uid: string; idToken: string; dayNumber: number }
): Promise<Response> => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };

      const candidateModels = getCandidateModels(requestedModel, false);
      const deadline = Date.now() + STREAM_BUDGET_MS;
      let produced = false;

      const wantsTools =
        !!requestedTools && !groundingDisabledForInstance && SEARCH_GROUNDING_MODE !== "off";

      for (const model of candidateModels) {
        if (Date.now() >= deadline - 3_000) break;

        const attempts: Array<Record<string, unknown> | undefined> = wantsTools && model === "gemini-2.5-flash"
          ? [config, stripTools(config)]
          : [stripTools(config)];

      for (const attemptConfig of attempts) {
        const remaining = deadline - Date.now();
        if (remaining < 3_000) break;

        // A status line doubles as a heartbeat: the browser watchdog treats
        // any incoming line as proof the connection is alive.
        send({ type: "status", model, attempt: 1 });

        const outcome = await runModel(apiKey, model, contents, attemptConfig, (piece) => {
          produced = true;
          send({ type: "chunk", text: piece, model });
        });

        if (outcome.status === "ok") {
          send({
            type: "done",
            text: outcome.text,
            modelUsed: outcome.model,
          });
          close();
          // The call produced a billable answer: charge it to the allowance.
          await recordAiUsage(quota.uid, quota.idToken, quota.dayNumber, "text");
          return;
        }

        if (produced) {
          // We cannot switch models after partial text without duplicating it.
          send({ type: "error", error: "The AI stream was interrupted. Please try again." });
          close();
          return;
        }
        if (attemptConfig && requestedTools && !isQuotaOrRateError(outcome.error)) {
          // Grounding is what the upstream rejected. Remember it so the next
          // request on this instance does not pay for the same failure.
          groundingDisabledForInstance = true;
          console.warn("[AI Proxy] Search grounding rejected by the upstream; retrying without it.");
        }
        console.warn(`[AI Proxy] Model ${model} failed: ${outcome.error}`);
      }
    }

      send({
        type: "error",
        error: "AI is temporarily unavailable. Please try again in a moment.",
      });
      close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
};

/**
 * Buffered text path for clients loaded before streaming shipped.
 */
const bufferText = async (
  apiKey: string,
  contents: unknown,
  config: Record<string, unknown>,
  requestedModel: string,
  requestedTools: any[] | undefined,
  quota: { uid: string; idToken: string; dayNumber: number }
): Promise<Response> => {
  const candidateModels = getCandidateModels(requestedModel, false);
  const wantsTools =
    !!requestedTools && !groundingDisabledForInstance && SEARCH_GROUNDING_MODE !== "off";

  for (const model of candidateModels) {
    const attempts: Array<Record<string, unknown> | undefined> = wantsTools && model === "gemini-2.5-flash"
      ? [config, stripTools(config)]
      : [stripTools(config)];

    for (const attemptConfig of attempts) {
      const outcome = await runModel(apiKey, model, contents, attemptConfig, () => {});
      if (outcome.status === "ok") {
        await recordAiUsage(quota.uid, quota.idToken, quota.dayNumber, "text");
        return jsonResponse(200, {
          text: outcome.text,
          modelUsed: outcome.model,
        });
      }
      if (attemptConfig && requestedTools && !isQuotaOrRateError(outcome.error)) {
        groundingDisabledForInstance = true;
      }
      console.warn(`[AI Proxy] Model ${model} failed: ${outcome.error}`);
    }
  }

  return jsonResponse(502, { error: "AI is temporarily unavailable. Please try again in a moment." });
};

const generateAudio = async (
  apiKey: string,
  contents: unknown,
  config: Record<string, unknown>,
  requestedModel: string,
  quota: { uid: string; idToken: string; dayNumber: number }
): Promise<Response> => {
  const model = resolveModel(requestedModel, true);

  for (const candidate of Array.from(new Set([model, ...AUDIO_MODELS])).slice(0, 2)) {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), MODEL_TIMEOUT_MS);
    try {
      const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: MODEL_TIMEOUT_MS } });
      const response = await client.models.generateContent({
        model: candidate,
        contents: contents as any,
        config: { ...config, abortSignal: abortController.signal },
      });
      await recordAiUsage(quota.uid, quota.idToken, quota.dayNumber, "audio");
      return jsonResponse(200, {
        text: response.text || "",
        candidates: response.candidates || [],
        promptFeedback: response.promptFeedback || null,
        modelUsed: candidate,
      });
    } catch (error: any) {
      console.warn(`[AI Proxy] Audio model ${candidate} failed: ${errorMessage(error)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  return jsonResponse(502, { error: "Audio generation is temporarily unavailable." });
};

export default async (request: Request, _context: any): Promise<Response> => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "AI service is not configured." });
  }

  // ── 1. Authenticate the caller ───────────────────────────────────────────
  const { user, reason } = await authenticate(request);
  if (!user) {
    return jsonResponse(401, {
      error:
        reason === "missing_token"
          ? "Sign in to use the AI features."
          : "Your session has expired. Please sign in again.",
    });
  }

  const idToken = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  // ── 2. Enforce the daily allowance ──────────────────────────────────────
  const dayNumber = utcDayNumber();
  const plan = await getUserPlan(user.uid, idToken);
  const limit = plan === "premium" ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const used = await countAiUsageToday(user.uid, idToken, dayNumber);
  if (used === null) {
    // Fail closed: if the counter cannot be read we cannot know whether the
    // allowance is spent, and the paid key is on the other side of the door.
    return jsonResponse(503, { error: "The AI service is busy. Please try again in a moment." });
  }
  if (used >= limit) {
    return jsonResponse(429, {
      error:
        plan === "premium"
          ? "You have reached your daily AI limit. It resets tomorrow."
          : "You have used all of today's free AI advice. It resets tomorrow.",
      limit,
      used,
    });
  }

  // ── 3. Read and validate the body ────────────────────────────────────────
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonResponse(400, { error: "Invalid request body." });
  }
  if (raw.length > MAX_REQUEST_BYTES) {
    return jsonResponse(413, { error: "That request is too large to send." });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const contents = body?.contents;
  if (!contents) {
    return jsonResponse(400, { error: "Missing contents." });
  }

  const { textChars, images } = measureContents(contents);
  if (textChars > MAX_TOTAL_TEXT_CHARS) {
    return jsonResponse(413, { error: "That request contains too much text." });
  }
  if (images > MAX_INLINE_IMAGES) {
    return jsonResponse(413, {
      error: `You can send at most ${MAX_INLINE_IMAGES} images at a time.`,
    });
  }
  if (Array.isArray(contents) && contents.length > 100) {
    return jsonResponse(400, { error: "Too many conversation turns in a single request." });
  }

  // ── 4. Build the upstream config ─────────────────────────────────────────
  const callerConfig = (body.config || {}) as Record<string, unknown>;
  const config: Record<string, unknown> = { ...callerConfig };
  for (const key of ["responseModalities", "speechConfig", "generationConfig"]) {
    if (body[key] !== undefined) config[key] = body[key];
  }
  // The caller does not get to choose how many tokens the answer may use.
  config.maxOutputTokens = Math.min(
    Math.max(Number(callerConfig.maxOutputTokens) || MAX_OUTPUT_TOKENS, 256),
    MAX_OUTPUT_TOKENS
  );
  // Safety settings are the server's decision.
  delete config.safetySettings;
  // Only Google Search may be requested, and only when the caller asked.
  const requestedTools = sanitizeTools(body.tools);
  if (requestedTools) config.tools = requestedTools;
  else delete config.tools;
  delete config.toolConfig;

  const modalities = (config.responseModalities || []) as string[];
  const isAudio = Array.isArray(modalities) && modalities.includes("AUDIO");
  const requestedModel = body?.model;

  const quota = { uid: user.uid, idToken, dayNumber };

  if (isAudio) {
    return generateAudio(apiKey, contents, config, requestedModel, quota);
  }
  // Streaming is opt-in so an old page loaded before a deploy still gets the
  // buffered JSON shape it understands.
  if (body?.stream === true) {
    return streamText(apiKey, contents, config, requestedModel, requestedTools, quota);
  }
  return bufferText(apiKey, contents, config, requestedModel, requestedTools, quota);
};
