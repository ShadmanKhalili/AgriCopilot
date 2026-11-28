/**
 * Keeping a Gemini Live session alive: the connection settings that stop the
 * two-minute video cut-off, and the reconnect logic for the 10-minute
 * connection limit (`goAway`) and for dropped connections.
 *
 * What Google's Live API does (docs/audit/GEMINI_CAPABILITIES.md, 2.3):
 *   - audio + video ends after about 2 minutes, audio only after about 15,
 *     unless `contextWindowCompression` is set;
 *   - any WebSocket is closed after about 10 minutes, with a `goAway` message
 *     first (`timeLeft`);
 *   - with `sessionResumption` on, the server sends `sessionResumptionUpdate`
 *     (`newHandle`, `resumable`); a new connection that passes that handle in
 *     `sessionResumption.handle` carries on the same conversation, for up to
 *     about 2 hours, even with a single-use ephemeral token.
 *
 * Everything that decides what to do is a pure function here (`shouldReconnect`,
 * `nextHandle`, `parseTimeLeftMs`), so it is unit-tested without a socket. The
 * components own the camera, microphone, audio playback and transcripts and
 * leave them running across a reconnect; `createLiveReconnector` only decides
 * when to open a new connection and with what.
 */

import { liveContextWindowCompression } from '../../netlify/functions/_shared/live-session-config';

/** Reconnect tries in a row before the session is given up. */
export const MAX_RECONNECT_ATTEMPTS = 3;
/** Wait before reconnect try 1, 2, 3 after an unexpected close. */
export const RECONNECT_BACKOFF_MS = [0, 1500, 4000] as const;
/**
 * Hard cap on resumes (fresh tokens, each one a daily live session) in one
 * call. The stable-connection reset does NOT clear it.
 */
export const MAX_RESUMES_PER_CALL = 5;
/** A resume connection that is not open after this long counts as failed. */
export const RESUME_CONNECT_TIMEOUT_MS = 10_000;
/** Minting the fresh token for a resume may take this long before it counts as failed. */
export const RESUME_TOKEN_TIMEOUT_MS = 15_000;
/** A resumed connection that stays up this long gets a fresh set of tries. */
export const RECONNECT_STABLE_MS = 30_000;
/** On `goAway`, reconnect this long before the server's deadline... */
export const GO_AWAY_LEAD_MS = 4000;
/** ...but never wait longer than this, so the fresh handle is not stale. */
export const GO_AWAY_MAX_WAIT_MS = 8000;
/**
 * One video frame per second: Google's Live API takes at most 1 frame/second,
 * and the 3.8 Live models read every frame that is sent.
 */
export const LIVE_VIDEO_FRAME_INTERVAL_MS = 1000;

/**
 * The fields every Live connection sends: compression on (the server locks the
 * same value into the token) and resumption on with no handle yet.
 * `transparent` is left out: the Gemini API rejects it.
 */
export const liveResilienceConfig = () => ({
  contextWindowCompression: liveContextWindowCompression(),
  sessionResumption: {} as { handle?: string },
});

/** The same config with a resume handle, for a reconnect. */
export const withResumeHandle = <T extends object>(config: T, handle: string): T & { sessionResumption: { handle: string } } => ({
  ...config,
  sessionResumption: { handle },
});

// ---------------------------------------------------------------------------
// Pure decisions
// ---------------------------------------------------------------------------

export interface ResumptionUpdateLike {
  newHandle?: string;
  resumable?: boolean;
}

/**
 * The handle to keep after a `sessionResumptionUpdate`. A usable update has
 * `resumable: true` and a non-empty `newHandle`. An update with `resumable:
 * false` (the model is mid-answer or running a function) carries an empty
 * handle: keep the previous one, which is still valid for the last good state.
 */
export const nextHandle = (current: string | null, update?: ResumptionUpdateLike | null): string | null => {
  if (!update) return current;
  if (update.resumable === true && typeof update.newHandle === 'string' && update.newHandle.length > 0) {
    return update.newHandle;
  }
  return current;
};

/**
 * `goAway.timeLeft` as milliseconds. The SDK types it as a string and the API
 * sends a protobuf Duration ("50s", "0.5s"); `{ seconds, nanos }` and a plain
 * number of seconds are read too. Anything else is null.
 */
export const parseTimeLeftMs = (timeLeft: unknown): number | null => {
  if (typeof timeLeft === 'number' && Number.isFinite(timeLeft) && timeLeft >= 0) return Math.round(timeLeft * 1000);
  if (typeof timeLeft === 'string') {
    const m = /^\s*(\d+(?:\.\d+)?)\s*s?\s*$/i.exec(timeLeft);
    if (m) return Math.round(Number(m[1]) * 1000);
    return null;
  }
  if (timeLeft && typeof timeLeft === 'object') {
    const t = timeLeft as { seconds?: unknown; nanos?: unknown };
    const seconds = Number(t.seconds ?? 0);
    const nanos = Number(t.nanos ?? 0);
    if (Number.isFinite(seconds) && Number.isFinite(nanos) && seconds >= 0 && nanos >= 0) {
      return Math.round(seconds * 1000 + nanos / 1e6);
    }
  }
  return null;
};

export type ReconnectReason = 'goAway' | 'close' | 'error';
export type ReconnectStopReason = 'never-connected' | 'no-handle' | 'max-attempts' | 'limit' | 'resume-cap';

export interface ReconnectState {
  /** The latest resumable handle from the server, if any. */
  handle: string | null;
  /** Reconnect tries used since the session last held steady. */
  attempts: number;
  /** Resumes (fresh tokens) used in this whole call; never reset. */
  resumes: number;
  /** True once the first connection of this session was open. */
  hasConnected: boolean;
  /** True while a reconnect is waiting or connecting. */
  isReconnecting: boolean;
  /** True once the farmer stopped the session (or it was given up). */
  userStopped: boolean;
}

export type ReconnectEvent =
  | { type: 'goAway'; timeLeftMs?: number | null }
  | { type: 'close' }
  | { type: 'error' };

export type ReconnectDecision =
  | { action: 'ignore' }
  | { action: 'stop'; reason: ReconnectStopReason }
  | { action: 'reconnect'; attempt: number; delayMs: number; reason: ReconnectReason };

export const initialReconnectState = (): ReconnectState => ({
  handle: null,
  attempts: 0,
  resumes: 0,
  hasConnected: false,
  isReconnecting: false,
  userStopped: false,
});

/** How long to wait before try `attempt` (1-based). */
export const reconnectDelayMs = (attempt: number, event: ReconnectEvent): number => {
  if (event.type === 'goAway') {
    const left = event.timeLeftMs;
    if (typeof left !== 'number' || !Number.isFinite(left)) return 0;
    return Math.min(GO_AWAY_MAX_WAIT_MS, Math.max(0, left - GO_AWAY_LEAD_MS));
  }
  const i = Math.min(Math.max(attempt, 1), RECONNECT_BACKOFF_MS.length) - 1;
  return RECONNECT_BACKOFF_MS[i];
};

/**
 * What to do when the server says `goAway` or the connection closes or errors.
 *
 *  - The farmer already stopped, or a reconnect is already running: ignore (one
 *    drop often raises both `onerror` and `onclose`).
 *  - A close before the session ever opened: stop.
 *  - No resume handle yet: a `goAway` is ignored (the session keeps working
 *    until the server closes it); a close or error stops, because there is
 *    nothing to resume.
 *  - Tries used up: stop (a `goAway` is ignored the same way).
 *  - Resumes used up for the whole call (quota guard): stop.
 *  - Otherwise reconnect. Every try asks for a fresh token: tokens are
 *    single-use.
 */
export const shouldReconnect = (state: ReconnectState, event: ReconnectEvent): ReconnectDecision => {
  if (state.userStopped || state.isReconnecting) return { action: 'ignore' };
  if (!state.hasConnected) {
    return event.type === 'goAway' ? { action: 'ignore' } : { action: 'stop', reason: 'never-connected' };
  }
  if (!state.handle) {
    return event.type === 'goAway' ? { action: 'ignore' } : { action: 'stop', reason: 'no-handle' };
  }
  if (state.resumes >= MAX_RESUMES_PER_CALL) {
    return event.type === 'goAway' ? { action: 'ignore' } : { action: 'stop', reason: 'resume-cap' };
  }
  if (state.attempts >= MAX_RECONNECT_ATTEMPTS) {
    return event.type === 'goAway' ? { action: 'ignore' } : { action: 'stop', reason: 'max-attempts' };
  }
  const attempt = state.attempts + 1;
  return {
    action: 'reconnect',
    attempt,
    delayMs: reconnectDelayMs(attempt, event),
    reason: event.type,
  };
};

/** The short message for the farmer, in their language. */
export const liveReconnectMessage = (kind: 'reconnecting' | 'failed' | 'limit' | 'resume-cap', lang: string): string => {
  const bn = lang === 'bn';
  if (kind === 'reconnecting') return bn ? 'সংযোগ আবার চালু করা হচ্ছে…' : 'Reconnecting the live session…';
  if (kind === 'limit') {
    return bn
      ? 'আজকের লাইভ সেশনের সীমা শেষ, অথবা এই সংযোগ থেকে অনেক অনুরোধ এসেছে। ছবি দিয়ে রোগ নির্ণয় ও চ্যাট এখনো চালু আছে; পরে আবার চেষ্টা করুন।'
      : 'The live session limit for today has been reached. Photo diagnosis and chat still work; please try again later.';
  }
  if (kind === 'resume-cap') {
    return bn
      ? 'এই কলে সংযোগ অনেকবার বিচ্ছিন্ন হয়েছে। নেটওয়ার্ক ভালো হলে নতুন করে শুরু করুন।'
      : 'The connection dropped too many times during this call. Please start again when the network is steadier.';
  }
  return bn ? 'লাইভ সংযোগ বিচ্ছিন্ন হয়েছে। আবার শুরু করুন।' : 'The live connection was lost. Please start again.';
};

// ---------------------------------------------------------------------------
// Connecting with a resume handle
// ---------------------------------------------------------------------------

/** A promise that rejects after `ms`; `cancel` clears the timer. */
const timeoutAfter = (
  ms: number,
  message: string,
  setTimer: (fn: () => void, ms: number) => unknown,
  clearTimer: (id: unknown) => void
) => {
  let id: unknown = null;
  const promise = new Promise<never>((_, reject) => {
    id = setTimer(() => reject(new Error(message)), ms);
  });
  promise.catch(() => {});
  return { promise, cancel: () => clearTimer(id) };
};

// ---------------------------------------------------------------------------
// The reconnect controller
// ---------------------------------------------------------------------------

export interface LiveReconnectorDeps<C, S> {
  /** Open a connection with `client` that resumes from `handle`. */
  connect: (client: C, handle: string) => Promise<S>;
  /** A client on a newly minted token (counts one more live session). Tokens are single-use, so every resume asks for one. */
  getFreshClient: () => Promise<C>;
  /** False once the farmer stopped the session or the component moved on. */
  isCurrent: () => boolean;
  /** Drop the old socket so its late callbacks are ignored. Safe to call twice. */
  closeOld: () => void;
  /** A reconnect is starting: show the notice, reset any half-played turn. */
  onReconnecting: (info: { attempt: number; reason: ReconnectReason }) => void;
  /** The resumed session is open: use it for audio and video from now on. */
  onResumed: (session: S) => void;
  /** Resumption is impossible: tell the farmer and stop cleanly. */
  onGiveUp: (reason: ReconnectStopReason) => void;
  /** Timers and clock, replaceable in tests. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  now?: () => number;
}

export interface LiveReconnector<C, M = LiveMessageLike> {
  /** The first connection of the session is open. */
  markConnected: () => void;
  /** Feed every server message; it reads `sessionResumptionUpdate` and `goAway`. */
  handleMessage: (message: M | null | undefined) => void;
  handleClose: () => void;
  handleError: () => void;
  /** The farmer ended the session: cancel anything pending. */
  stop: () => void;
  getState: () => Readonly<ReconnectState>;
}

export interface LiveMessageLike {
  goAway?: { timeLeft?: unknown } | null;
  sessionResumptionUpdate?: ResumptionUpdateLike | null;
}

export const createLiveReconnector = <C, S>(deps: LiveReconnectorDeps<C, S>): LiveReconnector<C> => {
  const state = initialReconnectState();
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const now = deps.now ?? (() => Date.now());
  /** Fails the resume attempt that is waiting for its socket to open. */
  let failPending: ((err: Error) => void) | null = null;
  let timer: unknown = null;
  let runId = 0;
  let stableSince: number | null = null;

  const cancelled = (id: number) => id !== runId || state.userStopped || !deps.isCurrent();

  const giveUp = (reason: ReconnectStopReason) => {
    failPending = null;
    state.isReconnecting = false;
    state.userStopped = true;
    runId += 1;
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    deps.onGiveUp(reason);
  };

  const request = (event: ReconnectEvent) => {
    // A resumed connection that held steady earns a fresh set of tries, so a
    // two-hour session is not limited to three reconnects in all.
    if (stableSince !== null && now() - stableSince >= RECONNECT_STABLE_MS) {
      state.attempts = 0;
    }
    const decision = shouldReconnect(state, event);
    if (decision.action === 'ignore') return;
    if (decision.action === 'stop') {
      giveUp(decision.reason);
      return;
    }
    state.attempts = decision.attempt;
    state.resumes += 1;
    state.isReconnecting = true;
    stableSince = null;
    const id = ++runId;
    timer = setTimer(() => {
      timer = null;
      void run(id, decision);
    }, decision.delayMs);
  };

  const run = async (id: number, decision: Extract<ReconnectDecision, { action: 'reconnect' }>) => {
    if (cancelled(id)) return;
    const handle = state.handle;
    if (!handle) {
      giveUp('no-handle');
      return;
    }
    deps.closeOld();
    deps.onReconnecting({ attempt: decision.attempt, reason: decision.reason });
    let settled = false;
    const early = new Promise<never>((_, reject) => {
      failPending = (err) => reject(err);
    });
    early.catch(() => {});
    const tokenTimeout = timeoutAfter(RESUME_TOKEN_TIMEOUT_MS, 'resume token timeout', setTimer, clearTimer);
    let connectTimeout: ReturnType<typeof timeoutAfter> | null = null;
    const closeLate = (session: unknown) => {
      try {
        (session as { close?: () => void } | null)?.close?.();
      } catch {
        // Already closed.
      }
    };
    try {
      // Every resume mints a new token: the previous one was single-use.
      let freshClient: C;
      try {
        freshClient = await Promise.race([deps.getFreshClient(), tokenTimeout.promise, early]);
      } finally {
        tokenTimeout.cancel();
      }
      if (cancelled(id)) return;
      connectTimeout = timeoutAfter(RESUME_CONNECT_TIMEOUT_MS, 'resume connect timeout', setTimer, clearTimer);
      const connecting = deps.connect(freshClient, handle);
      // If this try was abandoned (timeout, early close) and the socket opens
      // later anyway, close it so it cannot linger.
      connecting.then(
        (late) => {
          if (settled) closeLate(late);
        },
        () => {}
      );
      const session = await Promise.race([connecting, connectTimeout.promise, early]);
      connectTimeout.cancel();
      failPending = null;
      if (cancelled(id)) {
        settled = true;
        closeLate(session);
        return;
      }
      settled = true;
      state.isReconnecting = false;
      state.hasConnected = true;
      stableSince = now();
      deps.onResumed(session);
    } catch (err) {
      settled = true;
      failPending = null;
      connectTimeout?.cancel();
      if (cancelled(id)) return;
      state.isReconnecting = false;
      // The daily live-session allowance is used up: another try cannot work.
      if ((err as { status?: number } | null)?.status === 429) {
        giveUp('limit');
        return;
      }
      request({ type: 'close' });
    }
  };

  /**
   * A close or error while a resume socket is still opening fails that try
   * (the SDK's connect() never rejects in that case). Otherwise it is a normal
   * drop signal.
   */
  const dropSignal = (event: ReconnectEvent) => {
    if (failPending) {
      const fail = failPending;
      failPending = null;
      fail(new Error(`resume connection ${event.type} before open`));
      return;
    }
    request(event);
  };

  return {
    markConnected: () => {
      state.hasConnected = true;
    },
    handleMessage: (message) => {
      if (!message || state.userStopped) return;
      if (message.sessionResumptionUpdate) {
        state.handle = nextHandle(state.handle, message.sessionResumptionUpdate);
      }
      if (message.goAway) {
        request({ type: 'goAway', timeLeftMs: parseTimeLeftMs(message.goAway.timeLeft) });
      }
    },
    handleClose: () => dropSignal({ type: 'close' }),
    handleError: () => dropSignal({ type: 'error' }),
    stop: () => {
      state.userStopped = true;
      state.isReconnecting = false;
      failPending = null;
      runId += 1;
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    },
    getState: () => state,
  };
};
