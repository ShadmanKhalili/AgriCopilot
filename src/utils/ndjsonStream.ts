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
  idleTimeoutMs: number = AI_STREAM_IDLE_TIMEOUT_MS
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
    }
  };

  try {
    armWatchdog();
    for (;;) {
      // Stop reading as soon as the server reports a terminal error.
      if (streamError) break;

      const { value, done } = await reader.read();
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
  }

  if (buffer.trim()) handleLine(buffer);

  if (streamError) throw streamError;
  if (stalled) throw new Error('The AI connection stalled. Please try again.');
  if (!finalEvent) {
    // A stream that closes without `done` was cut short (proxy timeout,
    // dropped mobile connection, or a killed function). Falling back to the
    // partial text would hand truncated JSON to the caller.
    throw new Error('The AI response ended before it was complete. Please try again.');
  }
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
