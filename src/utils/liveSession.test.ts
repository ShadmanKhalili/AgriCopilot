import { describe, expect, it, vi } from 'vitest';
import {
  GO_AWAY_LEAD_MS,
  GO_AWAY_MAX_WAIT_MS,
  LIVE_VIDEO_FRAME_INTERVAL_MS,
  MAX_RECONNECT_ATTEMPTS,
  MAX_RESUMES_PER_CALL,
  RESUME_CONNECT_TIMEOUT_MS,
  RECONNECT_BACKOFF_MS,
  RECONNECT_STABLE_MS,
  createLiveReconnector,
  initialReconnectState,
  liveReconnectMessage,
  liveResilienceConfig,
  nextHandle,
  parseTimeLeftMs,
  reconnectDelayMs,
  shouldReconnect,
  withResumeHandle,
  type ReconnectState,
} from './liveSession';

const state = (over: Partial<ReconnectState> = {}): ReconnectState => ({
  ...initialReconnectState(),
  hasConnected: true,
  handle: 'h1',
  ...over,
});

describe('liveResilienceConfig / withResumeHandle', () => {
  it('turns on compression and resumption, without the unsupported transparent flag', () => {
    const c = liveResilienceConfig();
    expect(c.contextWindowCompression.slidingWindow).toBeDefined();
    expect(c.contextWindowCompression.triggerTokens).toBe('50000');
    expect(c.sessionResumption).toEqual({});
    expect(JSON.stringify(c)).not.toContain('transparent');
  });

  it('passes the handle on a reconnect and keeps the rest of the config', () => {
    const base = { responseModalities: ['AUDIO'], ...liveResilienceConfig() };
    const next = withResumeHandle(base, 'abc');
    expect(next.sessionResumption).toEqual({ handle: 'abc' });
    expect(next.responseModalities).toEqual(['AUDIO']);
    expect(next.contextWindowCompression).toEqual(base.contextWindowCompression);
    expect(base.sessionResumption).toEqual({});
  });
});

describe('nextHandle', () => {
  it('takes a resumable update', () => {
    expect(nextHandle(null, { newHandle: 'a', resumable: true })).toBe('a');
    expect(nextHandle('a', { newHandle: 'b', resumable: true })).toBe('b');
  });
  it('keeps the old handle when the update is not resumable or empty', () => {
    expect(nextHandle('a', { newHandle: '', resumable: false })).toBe('a');
    expect(nextHandle('a', { newHandle: 'b', resumable: false })).toBe('a');
    expect(nextHandle('a', { newHandle: '', resumable: true })).toBe('a');
    expect(nextHandle('a', {})).toBe('a');
    expect(nextHandle('a', null)).toBe('a');
    expect(nextHandle(null, undefined)).toBeNull();
  });
});

describe('parseTimeLeftMs', () => {
  it.each([
    ['50s', 50_000],
    ['0.5s', 500],
    ['12', 12_000],
    [{ seconds: 3, nanos: 500_000_000 }, 3500],
    [7, 7000],
  ])('reads %j', (input, ms) => {
    expect(parseTimeLeftMs(input)).toBe(ms);
  });
  it.each([[undefined], [null], ['soon'], [-1], [NaN], [{}]])('returns null for %j', (input) => {
    // `{}` has no seconds: it reads as zero, which is a valid "now".
    const r = parseTimeLeftMs(input);
    if (typeof input === 'object' && input !== null) expect(r).toBe(0);
    else expect(r).toBeNull();
  });
});

describe('reconnectDelayMs', () => {
  it('uses the backoff table after a close and caps at its last value', () => {
    expect(reconnectDelayMs(1, { type: 'close' })).toBe(RECONNECT_BACKOFF_MS[0]);
    expect(reconnectDelayMs(2, { type: 'error' })).toBe(RECONNECT_BACKOFF_MS[1]);
    expect(reconnectDelayMs(3, { type: 'close' })).toBe(RECONNECT_BACKOFF_MS[2]);
    expect(reconnectDelayMs(9, { type: 'close' })).toBe(RECONNECT_BACKOFF_MS[2]);
  });
  it('waits until shortly before the goAway deadline, capped', () => {
    expect(reconnectDelayMs(1, { type: 'goAway', timeLeftMs: 60_000 })).toBe(GO_AWAY_MAX_WAIT_MS);
    expect(reconnectDelayMs(1, { type: 'goAway', timeLeftMs: GO_AWAY_LEAD_MS + 1500 })).toBe(1500);
    expect(reconnectDelayMs(1, { type: 'goAway', timeLeftMs: 1000 })).toBe(0);
    expect(reconnectDelayMs(1, { type: 'goAway', timeLeftMs: null })).toBe(0);
    expect(reconnectDelayMs(1, { type: 'goAway' })).toBe(0);
  });
});

describe('shouldReconnect', () => {
  it('reconnects on an unexpected close with a handle', () => {
    expect(shouldReconnect(state(), { type: 'close' })).toEqual({
      action: 'reconnect',
      attempt: 1,
      delayMs: 0,
      reason: 'close',
    });
    expect(shouldReconnect(state({ attempts: 2 }), { type: 'error' })).toMatchObject({ attempt: 3 });
  });

  it('stops at the per-call resume cap even when the tries were reset', () => {
    const capped = state({ attempts: 0, resumes: MAX_RESUMES_PER_CALL });
    expect(shouldReconnect(capped, { type: 'close' })).toEqual({ action: 'stop', reason: 'resume-cap' });
    expect(shouldReconnect(capped, { type: 'goAway' })).toEqual({ action: 'ignore' });
  });

  it('reconnects on goAway and waits for the deadline', () => {
    expect(shouldReconnect(state(), { type: 'goAway', timeLeftMs: 20_000 })).toMatchObject({
      action: 'reconnect',
      reason: 'goAway',
      delayMs: GO_AWAY_MAX_WAIT_MS,
    });
  });

  it('does nothing once the farmer has stopped', () => {
    expect(shouldReconnect(state({ userStopped: true }), { type: 'close' })).toEqual({ action: 'ignore' });
    expect(shouldReconnect(state({ userStopped: true }), { type: 'goAway' })).toEqual({ action: 'ignore' });
  });

  it('ignores a second signal while a reconnect is running', () => {
    expect(shouldReconnect(state({ isReconnecting: true }), { type: 'close' })).toEqual({ action: 'ignore' });
    expect(shouldReconnect(state({ isReconnecting: true }), { type: 'error' })).toEqual({ action: 'ignore' });
  });

  it('stops when the session never opened', () => {
    expect(shouldReconnect(state({ hasConnected: false }), { type: 'close' })).toEqual({
      action: 'stop',
      reason: 'never-connected',
    });
  });

  it('stops on a close with no handle, and lets a goAway run its course', () => {
    expect(shouldReconnect(state({ handle: null }), { type: 'close' })).toEqual({ action: 'stop', reason: 'no-handle' });
    expect(shouldReconnect(state({ handle: null }), { type: 'error' })).toEqual({ action: 'stop', reason: 'no-handle' });
    expect(shouldReconnect(state({ handle: null }), { type: 'goAway', timeLeftMs: 30_000 })).toEqual({ action: 'ignore' });
  });

  it('stops after the allowed tries', () => {
    const used = state({ attempts: MAX_RECONNECT_ATTEMPTS });
    expect(shouldReconnect(used, { type: 'close' })).toEqual({ action: 'stop', reason: 'max-attempts' });
    expect(shouldReconnect(used, { type: 'goAway' })).toEqual({ action: 'ignore' });
  });
});

describe('liveReconnectMessage', () => {
  it('gives the Bangla and English notices', () => {
    expect(liveReconnectMessage('reconnecting', 'bn')).toBe('সংযোগ আবার চালু করা হচ্ছে…');
    expect(liveReconnectMessage('failed', 'bn')).toBe('লাইভ সংযোগ বিচ্ছিন্ন হয়েছে। আবার শুরু করুন।');
    expect(liveReconnectMessage('reconnecting', 'en')).toMatch(/Reconnecting/);
    expect(liveReconnectMessage('failed', 'en')).toMatch(/start again/);
    expect(liveReconnectMessage('limit', 'en')).toMatch(/limit for today/);
    expect(liveReconnectMessage('limit', 'bn')).toMatch(/সীমা/);
    expect(liveReconnectMessage('resume-cap', 'en')).toMatch(/too many times/);
    expect(liveReconnectMessage('resume-cap', 'bn')).not.toBe(liveReconnectMessage('failed', 'bn'));
  });
});

describe('live video frame rate', () => {
  it('is at most one frame per second', () => {
    expect(LIVE_VIDEO_FRAME_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
  });
});

describe('createLiveReconnector', () => {
  /** A controller wired to fakes, with a manual clock and timer queue. */
  const setup = (overrides: Record<string, unknown> = {}) => {
    let clock = 1_000_000;
    const timers: Array<{ id: number; fn: () => void; ms: number }> = [];
    let nextId = 1;
    let current = true;
    const events: string[] = [];
    const connect = vi.fn(async (client: string, handle: string) => ({ client, handle, close: vi.fn() }));
    const getFreshClient = vi.fn(async () => 'fresh');
    const deps = {
      connect,
      getFreshClient,
      isCurrent: () => current,
      closeOld: vi.fn(() => events.push('closeOld')),
      onReconnecting: vi.fn((i: { attempt: number; reason: string }) => events.push(`reconnecting:${i.attempt}:${i.reason}`)),
      onResumed: vi.fn(() => events.push('resumed')),
      onGiveUp: vi.fn((r: string) => events.push(`giveUp:${r}`)),
      setTimer: (fn: () => void, ms: number) => {
        const id = nextId++;
        timers.push({ id, fn, ms });
        return id;
      },
      clearTimer: (id: unknown) => {
        const i = timers.findIndex((t) => t.id === id);
        if (i >= 0) timers.splice(i, 1);
      },
      now: () => clock,
      ...overrides,
    };
    const r = createLiveReconnector<string, any>(deps as any);
    r.markConnected();
    const flush = async () => {
      const t = timers.shift();
      t?.fn();
      await new Promise((res) => setTimeout(res, 0));
    };
    return {
      r,
      deps,
      events,
      timers,
      connect,
      getFreshClient,
      flush,
      advance: (ms: number) => (clock += ms),
      setCurrent: (v: boolean) => (current = v),
    };
  };

  const resumable = (h: string) => ({ sessionResumptionUpdate: { newHandle: h, resumable: true } });

  it('tracks the latest handle from sessionResumptionUpdate', () => {
    const { r } = setup();
    r.handleMessage(resumable('h1'));
    r.handleMessage({ sessionResumptionUpdate: { newHandle: '', resumable: false } });
    expect(r.getState().handle).toBe('h1');
    r.handleMessage(resumable('h2'));
    expect(r.getState().handle).toBe('h2');
  });

  it('on goAway waits, then resumes with a fresh token and the latest handle', async () => {
    const { r, events, timers, connect, flush } = setup();
    r.handleMessage(resumable('h1'));
    r.handleMessage({ goAway: { timeLeft: '30s' } });
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(GO_AWAY_MAX_WAIT_MS);
    // The handle moves on while the controller waits for the quiet moment.
    r.handleMessage(resumable('h2'));
    await flush();
    expect(connect).toHaveBeenCalledWith('fresh', 'h2');
    expect(events).toEqual(['closeOld', 'reconnecting:1:goAway', 'resumed']);
    expect(r.getState().isReconnecting).toBe(false);
  });

  it('treats a double close/error signal as one reconnect', async () => {
    const { r, timers, connect, flush } = setup();
    r.handleMessage(resumable('h1'));
    r.handleError();
    r.handleClose();
    expect(timers).toHaveLength(1);
    await flush();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('asks for a fresh token on every attempt and never reuses one', async () => {
    const { r, connect, getFreshClient, flush } = setup();
    let n = 0;
    getFreshClient.mockImplementation(async () => `fresh-${++n}`);
    connect.mockRejectedValueOnce(new Error('down'));
    r.handleMessage(resumable('h1'));
    r.handleClose();
    await flush(); // try 1 fails
    await flush(); // try 2 succeeds
    expect(getFreshClient).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenNthCalledWith(1, 'fresh-1', 'h1');
    expect(connect).toHaveBeenNthCalledWith(2, 'fresh-2', 'h1');
  });

  it('retries with a fresh token and then gives up after three failed tries', async () => {
    const { r, events, connect, getFreshClient, flush } = setup();
    connect.mockRejectedValue(new Error('down'));
    r.handleMessage(resumable('h1'));
    r.handleClose();
    await flush();
    await flush();
    await flush();
    expect(events.filter((e) => e.startsWith('reconnecting'))).toEqual([
      'reconnecting:1:close',
      'reconnecting:2:close',
      'reconnecting:3:close',
    ]);
    expect(events[events.length - 1]).toBe('giveUp:max-attempts');
    expect(getFreshClient).toHaveBeenCalledTimes(3);
    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('counts a connect that never opens as a failed try (timeout)', async () => {
    vi.useFakeTimers();
    try {
      const { r, events, connect } = setup({ setTimer: undefined, clearTimer: undefined });
      connect.mockImplementation(() => new Promise(() => {}));
      r.handleMessage(resumable('h1'));
      r.handleClose();
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(5000); // backoff
        await vi.advanceTimersByTimeAsync(RESUME_CONNECT_TIMEOUT_MS + 1);
      }
      await vi.advanceTimersByTimeAsync(5000);
      expect(events.filter((e) => e.startsWith('reconnecting'))).toHaveLength(3);
      expect(events[events.length - 1]).toBe('giveUp:max-attempts');
      expect(events).not.toContain('resumed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes a socket that opens after its try timed out', async () => {
    vi.useFakeTimers();
    try {
      const { r, connect } = setup({ setTimer: undefined, clearTimer: undefined });
      const closeFn = vi.fn();
      let open!: (s: unknown) => void;
      connect.mockImplementationOnce(() => new Promise((res) => (open = res)) as any);
      r.handleMessage(resumable('h1'));
      r.handleClose();
      await vi.advanceTimersByTimeAsync(RESUME_CONNECT_TIMEOUT_MS + 1);
      open({ close: closeFn });
      await vi.advanceTimersByTimeAsync(0);
      expect(closeFn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts a close or error before the resume socket opens as a failed try', async () => {
    const { r, events, connect, flush, timers } = setup();
    connect.mockImplementation(() => new Promise(() => {}));
    r.handleMessage(resumable('h1'));
    r.handleClose();
    await flush(); // try 1 starts and waits for the socket
    expect(r.getState().isReconnecting).toBe(true);
    r.handleClose(); // the resume socket closed before opening
    await new Promise((res) => setTimeout(res, 0));
    expect(timers).toHaveLength(1); // try 2 is scheduled, with backoff
    expect(timers[0].ms).toBe(RECONNECT_BACKOFF_MS[1]);
    await flush();
    r.handleError();
    await new Promise((res) => setTimeout(res, 0));
    await flush();
    r.handleClose();
    await new Promise((res) => setTimeout(res, 0));
    expect(events.filter((e) => e.startsWith('reconnecting'))).toHaveLength(3);
    expect(events[events.length - 1]).toBe('giveUp:max-attempts');
  });

  it('caps fresh tokens per call and the stable-connection reset does not clear it', async () => {
    const { r, events, getFreshClient, advance, flush } = setup();
    r.handleMessage(resumable('h1'));
    for (let i = 0; i < MAX_RESUMES_PER_CALL; i++) {
      r.handleClose();
      await flush();
      advance(RECONNECT_STABLE_MS + 1);
    }
    expect(events.filter((e) => e === 'resumed')).toHaveLength(MAX_RESUMES_PER_CALL);
    r.handleClose();
    expect(events[events.length - 1]).toBe('giveUp:resume-cap');
    expect(getFreshClient).toHaveBeenCalledTimes(MAX_RESUMES_PER_CALL);
  });

  it('gives up at once with no handle', () => {
    const { r, events } = setup();
    r.handleClose();
    expect(events).toEqual(['giveUp:no-handle']);
  });

  it('gives up at once when the daily live-session limit stops a fresh token', async () => {
    const { r, events, connect, flush } = setup({
      getFreshClient: vi.fn(async () => {
        throw Object.assign(new Error('limit'), { status: 429 });
      }),
    });
    r.handleMessage(resumable('h1'));
    r.handleClose();
    await flush();
    expect(events[events.length - 1]).toBe('giveUp:limit');
    expect(connect).not.toHaveBeenCalled();
  });

  it('does nothing after the farmer stops, and cancels a pending reconnect', async () => {
    const { r, events, timers, connect } = setup();
    r.handleMessage(resumable('h1'));
    r.handleMessage({ goAway: { timeLeft: '30s' } });
    expect(timers).toHaveLength(1);
    r.stop();
    expect(timers).toHaveLength(0);
    r.handleClose();
    r.handleError();
    expect(connect).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('closes a session that opened after the farmer stopped', async () => {
    const { r, events, connect, flush, setCurrent } = setup();
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const closeFn = vi.fn();
    connect.mockImplementation(async (client: string, handle: string) => {
      await gate;
      return { client, handle, close: closeFn };
    });
    r.handleMessage(resumable('h1'));
    r.handleClose();
    await flush();
    setCurrent(false);
    release();
    await new Promise((res) => setTimeout(res, 0));
    expect(closeFn).toHaveBeenCalledTimes(1);
    expect(events).not.toContain('resumed');
  });

  it('gives a steady resumed session a fresh set of tries', async () => {
    const { r, events, advance, flush } = setup();
    r.handleMessage(resumable('h1'));
    const rounds = MAX_RESUMES_PER_CALL;
    for (let i = 0; i < rounds; i++) {
      r.handleClose();
      await flush();
      advance(RECONNECT_STABLE_MS + 1);
    }
    expect(events.filter((e) => e === 'resumed')).toHaveLength(rounds);
    expect(events.some((e) => e.startsWith('giveUp'))).toBe(false);
  });

  it('does not reset the tries for a connection that drops straight away', async () => {
    const { r, events, advance, flush } = setup();
    r.handleMessage(resumable('h1'));
    for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
      r.handleClose();
      await flush();
      advance(1000);
    }
    r.handleClose();
    expect(events[events.length - 1]).toBe('giveUp:max-attempts');
  });

  it('keeps ignoring a goAway when it has no handle yet', () => {
    const { r, timers, events } = setup();
    r.handleMessage({ goAway: { timeLeft: '10s' } });
    expect(timers).toHaveLength(0);
    expect(events).toEqual([]);
  });
});
