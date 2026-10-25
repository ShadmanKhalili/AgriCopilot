/**
 * Parser for the AI proxy's newline-delimited JSON stream.
 *
 * The proxy emits one JSON object per line:
 *   { type: "status", model }            heartbeat while a fallback model warms up
 *   { type: "chunk", text }              incremental model output
 *   { type: "done", text, candidates }   terminal success
 *   { type: "error", error }             terminal failure
 *
 * The full text is assembled here because callers expect a complete JSON
 * document (structured diagnosis, market insights, etc.), not partial tokens.
 */

export const AI_STREAM_IDLE_TIMEOUT_MS = 30000;

export interface AiStreamResult {
  text: string;
  candidates: any[];
  promptFeedback: any;
  modelUsed?: string;
}

export async function readAiNdjsonStream(
  response: Response,
  idleTimeoutMs: number = AI_STREAM_IDLE_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<AiStreamResult> {
  if (!response.body) {
    throw new Error('AI stream is not readable in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamedText = '';
  let finalEvent: any = null;
  let streamError: Error | null = null;
  let stalled = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const armWatchdog = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      stalled = true;
      // Cancelling unblocks the pending read(); the loop below exits on `done`.
      void reader.cancel('AI stream stalled').catch(() => {});
    }, idleTimeoutMs);
  };

  // The caller gave up (e.g. the screen unmounted): stop downloading the
  // answer instead of leaving the connection open in the background.
  const onAbort = () => {
    void reader.cancel('aborted').catch(() => {});
  };
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  signal?.addEventListener('abort', onAbort, { once: true });

  const handleLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) return;

    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      // Ignore keep-alive noise or a truncated final line.
      return;
    }

    if (event?.type === 'chunk') {
      if (typeof event.text === 'string') streamedText += event.text;
      return;
    }
    if (event?.type === 'done') {
      if (typeof event.text === 'string' && event.text) streamedText = event.text;
      finalEvent = event;
      return;
    }
    if (event?.type === 'error') {
      streamError = new Error(event.error || 'The AI service returned an error.');
      // A coded refusal (safety block) must survive the trip through the
      // stream so the UI can tell it apart from a broken service. The partial
      // text is discarded when the error is thrown below, so nothing that
      // tripped a filter is ever displayed.
      if (event.code) (streamError as any).code = event.code;
      if (event.reason) (streamError as any).reason = event.reason;
    }
  };

  try {
    armWatchdog();
    for (;;) {
      // Stop reading as soon as the server reports a terminal error.
      if (streamError) break;
      // `done` is the terminal success event: the answer is complete. Keep
      // reading after it and the socket may sit idle until the watchdog fires,
      // which would discard an answer we already have.
      if (finalEvent) break;

      const { value, done } = await reader.read();
      // A cancelled download is not a truncated answer: report it as an abort
      // so the caller neither retries nor blames the farmer's connection.
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      if (done) break;

      armWatchdog();
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        handleLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        if (streamError) break;
        newlineIndex = buffer.indexOf('\n');
      }
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    signal?.removeEventListener('abort', onAbort);
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  if (buffer.trim()) handleLine(buffer);

  if (streamError) throw streamError;
  if (!finalEvent) {
    if (stalled) throw new Error('The AI connection stalled. Please try again.');
    // A stream that closes without `done` was cut short (proxy timeout,
    // dropped mobile connection, or a killed function). Falling back to the
    // partial text would hand truncated JSON to the caller.
    throw new Error('The AI response ended before it was complete. Please try again.');
  }
  // `finalEvent` is present: the server delivered a complete answer. A stall
  // after that point must not throw away the answer we already received.
  if (!streamedText) {
    throw new Error('AI returned an empty response.');
  }

  return {
    text: streamedText,
    candidates: finalEvent.candidates ?? [],
    promptFeedback: finalEvent.promptFeedback ?? null,
    modelUsed: finalEvent.modelUsed
  };
}
