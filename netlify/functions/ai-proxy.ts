import { GoogleGenAI } from "@google/genai";

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
 */

const TEXT_FALLBACKS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"];
const AUDIO_FALLBACKS = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];
const MODEL_TIMEOUT_MS = 22_000;
const STREAM_BUDGET_MS = 50_000;

const jsonResponse = (statusCode: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const getCandidateModels = (requestedModel: string, isAudio: boolean): string[] => {
  const requested = requestedModel || "gemini-3.5-flash-lite";
  const candidates = isAudio || requested.includes("-tts")
    ? [requested, ...AUDIO_FALLBACKS]
    : [requested, ...TEXT_FALLBACKS];
  return Array.from(new Set(candidates.filter(Boolean)));
};

const normalizeConfig = (body: any): Record<string, unknown> => {
  const config = {
    ...(body.config || {}),
  } as Record<string, unknown>;
  for (const key of ["tools", "toolConfig", "responseModalities", "speechConfig", "generationConfig"]) {
    if (body[key] !== undefined) config[key] = body[key];
  }
  return config;
};

const errorMessage = (error: any): string => {
  const message = String(error?.message || error || "Unknown AI error");
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
};

const streamText = (
  apiKey: string,
  contents: unknown,
  config: Record<string, unknown>,
  requestedModel: string
): Response => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          // The client disconnected; stop trying to write.
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Stream already errored or was cancelled by the client.
        }
      };

      const models = getCandidateModels(requestedModel, false).slice(0, 3);
      const deadline = Date.now() + STREAM_BUDGET_MS;
      let emitted = false;
      let lastError: any = null;

      for (const [index, model] of models.entries()) {
        const remaining = deadline - Date.now();
        if (remaining < 3_000) break;

        // A status line doubles as a heartbeat: the browser watchdog treats any
        // incoming line as proof the connection is alive while a fallback model
        // is warming up.
        send({ type: "status", model, attempt: index + 1 });

        const abortController = new AbortController();
        const timeout = Math.min(MODEL_TIMEOUT_MS, remaining);
        const timer = setTimeout(() => abortController.abort(), timeout);

        try {
          const client = new GoogleGenAI({
            apiKey,
            httpOptions: { timeout },
          });
          const responseStream = await client.models.generateContentStream({
            model,
            contents: contents as any,
            config: {
              ...config,
              abortSignal: abortController.signal,
            },
          });

          let text = "";
          let lastChunk: any = null;
          for await (const chunk of responseStream) {
            lastChunk = chunk;
            const piece = chunk.text || "";
            if (piece) {
              emitted = true;
              text += piece;
              send({ type: "chunk", text: piece, model });
            }
          }

          if (text) {
            send({
              type: "done",
              text,
              modelUsed: model,
              candidates: lastChunk?.candidates || [],
              promptFeedback: lastChunk?.promptFeedback || null,
            });
            close();
            return;
          }
          lastError = new Error("Model returned an empty response.");
        } catch (error: any) {
          lastError = error;
          if (emitted) {
            // We cannot switch models after partial text without duplicating it.
            send({
              type: "error",
              error: "The AI stream was interrupted. Please try again.",
            });
            close();
            return;
          }
          console.warn(`[AI Proxy] Model ${model} failed:`, errorMessage(error));
        } finally {
          clearTimeout(timer);
        }
      }

      send({
        type: "error",
        error: `AI is temporarily unavailable. ${errorMessage(lastError)}`,
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
 * Buffered text path for clients loaded before streaming shipped. Pages that
 * are already open during a deploy keep sending requests without `stream`, so
 * they must continue receiving a single JSON body instead of NDJSON.
 */
const bufferText = async (
  apiKey: string,
  contents: unknown,
  config: Record<string, unknown>,
  requestedModel: string
): Promise<Response> => {
  const models = getCandidateModels(requestedModel, false).slice(0, 3);
  const deadline = Date.now() + STREAM_BUDGET_MS;
  let lastError: any = null;

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;

    const timeout = Math.min(MODEL_TIMEOUT_MS, remaining);
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeout);

    try {
      const client = new GoogleGenAI({
        apiKey,
        httpOptions: { timeout },
      });
      const response = await client.models.generateContent({
        model,
        contents: contents as any,
        config: { ...config, abortSignal: abortController.signal },
      });

      return jsonResponse(200, {
        text: response.text || "",
        candidates: response.candidates || [],
        promptFeedback: response.promptFeedback || null,
        modelUsed: model,
      });
    } catch (error: any) {
      lastError = error;
      console.warn(`[AI Proxy] Model ${model} failed:`, errorMessage(error));
    } finally {
      clearTimeout(timer);
    }
  }

  return jsonResponse(502, {
    error: `AI is temporarily unavailable. ${errorMessage(lastError)}`,
  });
};

const generateAudio = async (
  apiKey: string,
  contents: unknown,
  config: Record<string, unknown>,
  requestedModel: string
): Promise<Response> => {
  const models = getCandidateModels(requestedModel, true).slice(0, 2);
  let lastError: any = null;

  for (const model of models) {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), MODEL_TIMEOUT_MS);
    try {
      const client = new GoogleGenAI({
        apiKey,
        httpOptions: { timeout: MODEL_TIMEOUT_MS },
      });
      const response = await client.models.generateContent({
        model,
        contents: contents as any,
        config: { ...config, abortSignal: abortController.signal },
      });
      return jsonResponse(200, {
        text: response.text || "",
        candidates: response.candidates || [],
        promptFeedback: response.promptFeedback || null,
        modelUsed: model,
      });
    } catch (error: any) {
      lastError = error;
      console.warn(`[AI Proxy] Audio model ${model} failed:`, errorMessage(error));
    } finally {
      clearTimeout(timer);
    }
  }

  return jsonResponse(502, {
    error: `Audio generation is temporarily unavailable. ${errorMessage(lastError)}`,
  });
};

export default async (request: Request, _context: any): Promise<Response> => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "GEMINI_API_KEY is not configured on Netlify." });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const contents = body?.contents;
  const requestedModel = body?.model || "gemini-3.5-flash-lite";
  if (!contents) {
    return jsonResponse(400, { error: "Missing model or contents" });
  }
  if (typeof contents === "string" && contents.length > 50_000) {
    return jsonResponse(400, { error: "Contents payload exceeds safe size limit." });
  }
  if (Array.isArray(contents) && contents.length > 100) {
    return jsonResponse(400, { error: "Too many conversation turns in a single request." });
  }

  const config = normalizeConfig(body);
  const modalities = (config.responseModalities || []) as string[];
  const isAudio = Array.isArray(modalities) && modalities.includes("AUDIO");

  if (isAudio) {
    return generateAudio(apiKey, contents, config, requestedModel);
  }
  // Streaming is opt-in so an old page loaded before a deploy still gets the
  // buffered JSON shape it understands.
  if (body?.stream === true) {
    return streamText(apiKey, contents, config, requestedModel);
  }
  return bufferText(apiKey, contents, config, requestedModel);
};
