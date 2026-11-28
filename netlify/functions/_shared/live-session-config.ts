/**
 * Live API session settings the server locks into the token and the browser
 * sends again, so both sides name the same values. No imports: the browser
 * bundle reads this file too (src/utils/liveSession.ts).
 *
 * Why compression is on: Google's Live API ends a session that carries audio
 * and video after about two minutes (audio only: about fifteen) unless
 * `contextWindowCompression` is set. The sliding window drops the oldest turns
 * once the context passes `triggerTokens`, down to `targetTokens`. Both are
 * strings in the SDK types (`ContextWindowCompressionConfig`, `SlidingWindow`).
 *
 * The trigger is set below the model default (80% of the context window) on
 * purpose: Live re-reads the whole context on every turn, so a smaller window
 * is cheaper and quicker, and a farmer's questions are about what the camera
 * shows now. About 50k tokens is a few minutes of audio plus one frame a second.
 *
 * `sessionResumption` is NOT here. It is never locked, because the browser must
 * be free to pass a resume `handle` when it reconnects.
 */
export const LIVE_COMPRESSION_TRIGGER_TOKENS = '50000';
export const LIVE_COMPRESSION_TARGET_TOKENS = '25000';

/** A fresh copy each call, so a caller cannot change the shared value. */
export const liveContextWindowCompression = () => ({
  triggerTokens: LIVE_COMPRESSION_TRIGGER_TOKENS,
  slidingWindow: { targetTokens: LIVE_COMPRESSION_TARGET_TOKENS },
});
