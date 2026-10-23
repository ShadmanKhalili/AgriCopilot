/**
 * Fetch with a hard timeout and one-shot retry for idempotent requests.
 *
 * Rural mobile networks often accept the TCP connection and then stall; a bare
 * fetch can leave a spinner running forever. This wrapper guarantees every
 * request settles, and retries transient GET failures once.
 *
 * The timeout covers the response BODY as well as the headers. A connection
 * that is accepted and then dies mid-body (the classic rural-3G failure) is
 * aborted instead of leaving `res.json()` pending forever with the caller's
 * loading flag stuck on.
 */

export class FetchTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Milliseconds before the request is aborted. Default: 15 s. */
  timeoutMs?: number;
  /** Extra attempts for GET/HEAD only. Default: 1. */
  retries?: number;
  /** Base delay between attempts (multiplied by attempt number). Default: 600 ms. */
  retryDelayMs?: number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Abort handles for the responses produced by {@link fetchWithTimeout}. The
 * guarded response is a fresh `Response` object, so the handle cannot travel
 * with it without changing the public signature; a WeakMap keeps it private
 * and still lets {@link readJsonWithTimeout} abort the underlying request when
 * its own budget runs out.
 */
const abortHandles = new WeakMap<Response, () => void>();

/** Statuses that must not carry a body (the Response constructor rejects those). */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/**
 * Wrap a response body in an idle watchdog.
 *
 * If no bytes arrive for `idleTimeoutMs`, the request is aborted and the
 * consumer is failed with a {@link FetchTimeoutError} instead of waiting for a
 * body that will never complete.
 */
function guardBodyStream(
  stream: ReadableStream<Uint8Array>,
  idleTimeoutMs: number,
  onIdleTimeout: () => void
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let failed = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const fail = (error: Error) => {
    if (failed) return;
    failed = true;
    clearIdle();
    try {
      streamController?.error(error);
    } catch {
      // The stream may already be closed or errored.
    }
  };

  const armIdle = () => {
    clearIdle();
    idleTimer = setTimeout(() => {
      onIdleTimeout();
      fail(new FetchTimeoutError('Response body timed out'));
    }, idleTimeoutMs);
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      streamController = controller;
      if (failed) return;
      armIdle();
      try {
        const { value, done } = await reader.read();
        // The watchdog may have fired while we were waiting for this chunk.
        if (failed) return;
        if (done) {
          clearIdle();
          controller.close();
          return;
        }
        armIdle();
        controller.enqueue(value);
      } catch (err) {
        if (failed) return;
        clearIdle();
        controller.error(err);
      }
    },
    cancel(reason) {
      clearIdle();
      return reader.cancel(reason);
    }
  });
}

/**
 * Return a response whose body is protected by an idle watchdog.
 *
 * The returned object is a new `Response` (status, status text and headers are
 * copied) because the body stream has to be replaced; `res.json()`,
 * `res.text()` and `res.body.getReader()` all read the guarded stream.
 */
function guardResponseBody(
  response: Response,
  controller: AbortController,
  timeoutMs: number
): Response {
  const body = response.body;
  if (!body || NULL_BODY_STATUSES.has(response.status)) {
    // Nothing to read: the header timeout is the whole budget.
    return response;
  }

  const abort = () => {
    try {
      controller.abort();
    } catch {
      // Already aborted.
    }
  };

  const guarded = new Response(guardBodyStream(body, timeoutMs, abort), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });

  abortHandles.set(guarded, abort);

  return guarded;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 15000,
    retries = 1,
    retryDelayMs = 600,
    signal: externalSignal,
    ...init
  } = options;

  const method = (init.method || 'GET').toUpperCase();
  const canRetry = method === 'GET' || method === 'HEAD';
  const attempts = canRetry ? Math.max(0, retries) + 1 : 1;

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (externalSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const controller = new AbortController();
    let timedOut = false;
    // Header-phase watchdog. It is cleared as soon as the headers arrive; the
    // body phase is guarded separately by the idle watchdog in
    // guardResponseBody(), so a slow body is never cut short by this timer.
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });

      // The headers arrived in time: hand the body over to its own watchdog.
      clearTimeout(timer);

      // Retry only transient server/rate-limit responses.
      if (canRetry && attempt < attempts - 1 && (response.status === 429 || response.status >= 500)) {
        lastError = new Error(`HTTP ${response.status}`);
        try {
          await response.body?.cancel();
        } catch {
          // Body may already be consumed or locked; ignore.
        }
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }

      return guardResponseBody(response, controller, timeoutMs);
    } catch (error) {
      lastError = timedOut ? new FetchTimeoutError() : error;

      // A caller-initiated abort must not be retried or masked.
      if (externalSignal?.aborted) throw error;
      if (attempt >= attempts - 1) throw lastError;

      await wait(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed');
}

/**
 * Read a JSON body with a hard budget that covers the body read itself.
 *
 * {@link fetchWithTimeout} already aborts a body that stalls (no bytes for the
 * request's timeout). This helper adds a total budget for the read and aborts
 * the underlying request when that budget runs out, so a slow-but-progressing
 * body cannot hold the caller hostage either.
 *
 * When the response did not come from {@link fetchWithTimeout} there is no
 * abort handle: the read is still rejected with a {@link FetchTimeoutError},
 * but the underlying request is only stopped by the browser.
 */
export async function readJsonWithTimeout<T = any>(
  response: Response,
  timeoutMs: number = 15000
): Promise<T> {
  const abort = abortHandles.get(response);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const budget = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        abort?.();
      } catch {
        // Already aborted.
      }
      reject(new FetchTimeoutError('Response body timed out'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([response.json() as Promise<T>, budget]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
