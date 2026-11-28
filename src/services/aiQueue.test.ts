import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSlotLimiter } from './aiQueue';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createSlotLimiter', () => {
  it('runs up to max at once and queues the rest', async () => {
    const limiter = createSlotLimiter(2);
    const a = await limiter.acquire();
    await limiter.acquire();
    let thirdGranted = false;
    const third = limiter.acquire().then((release) => { thirdGranted = true; return release; });
    expect(limiter.active).toBe(2);
    expect(limiter.waiting).toBe(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(thirdGranted).toBe(false);
    a();
    await vi.advanceTimersByTimeAsync(100);
    await third;
    expect(thirdGranted).toBe(true);
    expect(limiter.active).toBe(2);
  });

  it('releasing twice frees only one slot', async () => {
    const limiter = createSlotLimiter(1);
    const release = await limiter.acquire();
    release();
    release();
    expect(limiter.active).toBe(0);
  });

  it('rejects at once when the signal is already aborted, without using a slot', async () => {
    const limiter = createSlotLimiter(1);
    const controller = new AbortController();
    controller.abort();
    await expect(limiter.acquire(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(limiter.active).toBe(0);
  });

  it('removes a waiting request from the line when it is aborted', async () => {
    const limiter = createSlotLimiter(1);
    const release = await limiter.acquire();
    const controller = new AbortController();
    const waiting = limiter.acquire(controller.signal);
    const rejected = expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(limiter.waiting).toBe(1);
    controller.abort();
    await rejected;
    expect(limiter.waiting).toBe(0);
    release();
    expect(limiter.active).toBe(0);
  });

  it('gives the reserved slot back when a request aborts during the hand-over gap', async () => {
    const limiter = createSlotLimiter(1);
    const release = await limiter.acquire();
    const controller = new AbortController();
    const waiting = limiter.acquire(controller.signal);
    const rejected = expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    release(); // slot is reserved for the waiter, hand-over is 100 ms away
    expect(limiter.active).toBe(1);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(100);
    expect(limiter.active).toBe(0);
    // And the limiter still works afterwards.
    const next = await limiter.acquire();
    expect(limiter.active).toBe(1);
    next();
    expect(limiter.active).toBe(0);
  });

  it('passes the slot on to the next waiter when one aborts during the gap', async () => {
    const limiter = createSlotLimiter(1);
    const release = await limiter.acquire();
    const controller = new AbortController();
    const first = limiter.acquire(controller.signal);
    const firstRejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    let secondGranted = false;
    const second = limiter.acquire().then((r) => { secondGranted = true; return r; });
    release();
    controller.abort();
    await firstRejected;
    await vi.advanceTimersByTimeAsync(100); // aborted waiter frees its slot
    await vi.advanceTimersByTimeAsync(100); // second waiter gets it
    const secondRelease = await second;
    expect(secondGranted).toBe(true);
    expect(limiter.active).toBe(1);
    secondRelease();
    expect(limiter.active).toBe(0);
  });
});
