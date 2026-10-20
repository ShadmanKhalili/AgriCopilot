/**
 * Fetch with a hard timeout and one-shot retry for idempotent requests.
 *
 * Rural mobile networks often accept the TCP connection and then stall; a bare
 * fetch can leave a spinner running forever. This wrapper guarantees every
 * request settles, and retries transient GET failures once.
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
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });

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

      return response;
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
