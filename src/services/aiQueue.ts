/**
 * A small concurrency limiter for AI requests: at most `max` run at once, the
 * rest wait in line, and a short gap is left between one request finishing and
 * the next one starting (the free AI tier allows few requests per minute).
 *
 * Aborting a request (AbortSignal) never leaks a slot:
 * - a request that is still waiting leaves the line at once and its promise rejects;
 * - a request that was handed a slot but has not started yet gives the slot back;
 * - the release function is safe to call more than once.
 */

export interface SlotLimiter {
  /** Resolves with a `release` function once a slot is free. Rejects with an AbortError if `signal` aborts first. */
  acquire(signal?: AbortSignal): Promise<() => void>;
  /** Requests running now (or about to start). */
  readonly active: number;
  /** Requests waiting for a slot. */
  readonly waiting: number;
}

interface Waiter {
  resolve: (release: () => void) => void;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
  onAbort: () => void;
  /** True once the waiter was rejected because its signal aborted. */
  aborted: boolean;
}

const abortError = () => new DOMException('Aborted', 'AbortError');

export function createSlotLimiter(max: number, handoffDelayMs = 100): SlotLimiter {
  let active = 0;
  const waiters: Waiter[] = [];

  const makeRelease = (): (() => void) => {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active--;
      dispatch();
    };
  };

  /** Give free slots to the next waiters. The slot is reserved at once, handed over after the gap. */
  function dispatch(): void {
    while (active < max && waiters.length > 0) {
      const waiter = waiters.shift()!;
      active++;
      setTimeout(() => {
        waiter.signal?.removeEventListener('abort', waiter.onAbort);
        if (waiter.aborted) {
          // Aborted during the gap: nobody will use the reserved slot.
          active--;
          dispatch();
          return;
        }
        waiter.resolve(makeRelease());
      }, handoffDelayMs);
    }
  }

  return {
    get active() {
      return active;
    },
    get waiting() {
      return waiters.length;
    },
    acquire(signal?: AbortSignal): Promise<() => void> {
      if (signal?.aborted) return Promise.reject(abortError());
      if (active < max && waiters.length === 0) {
        active++;
        return Promise.resolve(makeRelease());
      }
      return new Promise<() => void>((resolve, reject) => {
        const waiter: Waiter = {
          resolve,
          reject,
          signal,
          aborted: false,
          onAbort: () => {
            const index = waiters.indexOf(waiter);
            if (index !== -1) waiters.splice(index, 1);
            // If it was already given a slot, the hand-over timer frees it.
            waiter.aborted = true;
            reject(abortError());
          },
        };
        signal?.addEventListener('abort', waiter.onAbort, { once: true });
        waiters.push(waiter);
      });
    },
  };
}
