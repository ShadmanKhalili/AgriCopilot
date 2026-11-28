import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  configured: true,
  calls: [] as Array<{ path: string; init: any }>,
  // What the fake Firestore answers with.
  respond: (_n: number): Response => new Response('{}'),
  counter: 0,
}));

vi.mock('./service-account.ts', () => ({
  serviceAccountConfigured: () => state.configured,
  firestoreDocumentName: (path: string) => `projects/p/databases/d/documents/${path}`,
  adminFetch: async (path: string, init: any) => {
    state.calls.push({ path, init });
    state.counter += 1;
    return state.respond(state.counter);
  },
}));

import {
  DAILY_CAPACITY_ERROR,
  __resetGlobalCapMemoryForTests,
  chargeGlobalAiCall,
  dhakaDayKey,
  globalDailyCallCap,
} from './usage-quota.ts';

/** Fake Firestore counter: each commit returns the next number. */
const counting = (start = 0) => {
  let n = start;
  state.respond = () => {
    n += 1;
    return new Response(
      JSON.stringify({
        writeResults: [
          {
            transformResults: [
              { integerValue: String(n) },
              { integerValue: String(n) },
              { timestampValue: '2026-11-28T00:00:00Z' },
            ],
          },
        ],
      })
    );
  };
};

beforeEach(() => {
  state.configured = true;
  state.calls = [];
  state.counter = 0;
  state.respond = () => new Response('{}');
  delete process.env.AI_GLOBAL_DAILY_CALL_CAP;
  __resetGlobalCapMemoryForTests();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.AI_GLOBAL_DAILY_CALL_CAP;
});

describe('dhakaDayKey', () => {
  it('uses the Asia/Dhaka calendar day (UTC+6)', () => {
    expect(dhakaDayKey(new Date('2026-11-28T17:59:00Z'))).toBe('2026-11-28');
    expect(dhakaDayKey(new Date('2026-11-28T18:00:00Z'))).toBe('2026-11-29');
    expect(dhakaDayKey(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
  });
});

describe('globalDailyCallCap', () => {
  it('is null when unset or not a positive number', () => {
    expect(globalDailyCallCap()).toBeNull();
    for (const bad of ['', 'abc', '0', '-5']) {
      process.env.AI_GLOBAL_DAILY_CALL_CAP = bad;
      expect(globalDailyCallCap()).toBeNull();
    }
    process.env.AI_GLOBAL_DAILY_CALL_CAP = '5000';
    expect(globalDailyCallCap()).toBe(5000);
  });
});

describe('chargeGlobalAiCall', () => {
  it('does nothing and makes no request when no cap is set', async () => {
    expect(await chargeGlobalAiCall('text')).toEqual({ ok: true, enabled: false });
    expect(state.calls).toHaveLength(0);
  });

  it('increments the day document atomically with a commit transform', async () => {
    process.env.AI_GLOBAL_DAILY_CALL_CAP = '3';
    counting();
    const result = await chargeGlobalAiCall('audio', 1, new Date('2026-11-28T10:00:00Z'));
    expect(result).toEqual({ ok: true, enabled: true, count: 1, cap: 3 });

    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].path).toBe('/documents:commit');
    expect(state.calls[0].init.method).toBe('POST');
    const write = JSON.parse(state.calls[0].init.body).writes[0];
    expect(write.update.name).toBe('projects/p/databases/d/documents/aiUsageGlobal/2026-11-28');
    expect(write.update.fields).toEqual({});
    expect(write.updateMask).toEqual({ fieldPaths: [] });
    expect(write.updateTransforms).toEqual([
      { fieldPath: 'calls', increment: { integerValue: '1' } },
      { fieldPath: 'audioCalls', increment: { integerValue: '1' } },
      { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
    ]);
  });

  it('allows calls up to the cap and refuses the next one', async () => {
    process.env.AI_GLOBAL_DAILY_CALL_CAP = '2';
    counting();
    expect((await chargeGlobalAiCall('text')).ok).toBe(true);
    expect((await chargeGlobalAiCall('text')).ok).toBe(true);
    const third = await chargeGlobalAiCall('text');
    expect(third).toEqual({ ok: false, reason: DAILY_CAPACITY_ERROR, count: 3, cap: 2 });
  });

  it('stops writing once the cap is known to be reached today', async () => {
    process.env.AI_GLOBAL_DAILY_CALL_CAP = '1';
    counting();
    const when = new Date('2026-11-28T10:00:00Z');
    await chargeGlobalAiCall('text', 1, when);
    await chargeGlobalAiCall('text', 1, when); // over the cap
    const writes = state.calls.length;
    const again = await chargeGlobalAiCall('live', 1, when);
    expect(again.ok).toBe(false);
    expect(state.calls).toHaveLength(writes);
    // The next Dhaka day starts fresh.
    counting();
    const tomorrow = await chargeGlobalAiCall('text', 1, new Date('2026-11-28T18:30:00Z'));
    expect(tomorrow.ok).toBe(true);
    expect(state.calls).toHaveLength(writes + 1);
  });

  it('charges live sessions to the same counter with a weight', async () => {
    process.env.AI_GLOBAL_DAILY_CALL_CAP = '10';
    counting();
    await chargeGlobalAiCall('live', 5);
    const write = JSON.parse(state.calls[0].init.body).writes[0];
    expect(write.updateTransforms[0]).toEqual({ fieldPath: 'calls', increment: { integerValue: '5' } });
    expect(write.updateTransforms[1]).toEqual({ fieldPath: 'liveCalls', increment: { integerValue: '5' } });
  });

  it('fails open when Firestore errors, answers oddly or throws', async () => {
    process.env.AI_GLOBAL_DAILY_CALL_CAP = '1';
    state.respond = () => new Response('boom', { status: 500 });
    expect((await chargeGlobalAiCall('text')).ok).toBe(true);
    state.respond = () => new Response('{}');
    expect((await chargeGlobalAiCall('text')).ok).toBe(true);
    state.respond = () => {
      throw new Error('network down');
    };
    expect((await chargeGlobalAiCall('text')).ok).toBe(true);
  });

  it('fails open (with a warning) when the cap is set but there is no service account', async () => {
    process.env.AI_GLOBAL_DAILY_CALL_CAP = '1';
    state.configured = false;
    expect(await chargeGlobalAiCall('text')).toEqual({ ok: true, enabled: false });
    expect(state.calls).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
  });
});
