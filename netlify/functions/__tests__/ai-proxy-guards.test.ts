import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two new abuse guards in front of the AI proxy: App Check and the
 * app-wide daily cap. Both stop the request before any Gemini work, so these
 * tests never reach the upstream.
 */
const state = vi.hoisted(() => ({
  recorded: 0,
  charge: { ok: true, enabled: false } as any,
  charged: [] as string[],
}));

vi.mock('../_shared/auth.ts', () => ({
  authenticate: async () => ({
    user: { uid: 'farmer-1', email: 'a@b.c', emailVerified: true, isGuest: false },
  }),
}));

vi.mock('../_shared/usage-quota.ts', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getUserPlan: async () => 'free',
    countAiUsageToday: async () => 0,
    recordAiUsage: async () => {
      state.recorded += 1;
      // Stop the handler right after the quota step, before Gemini.
      return false;
    },
    chargeGlobalAiCall: async (kind: string) => {
      state.charged.push(kind);
      return state.charge;
    },
  };
});

import handler from '../ai-proxy';

const call = (headers: Record<string, string> = {}) =>
  handler(
    new Request('https://example.test/api/ai-proxy', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }] }),
    }),
    {}
  );

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.APP_CHECK_MODE;
  delete process.env.APP_CHECK_PROJECT_NUMBER;
  state.recorded = 0;
  state.charged = [];
  state.charge = { ok: true, enabled: false };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.APP_CHECK_MODE;
  delete process.env.APP_CHECK_PROJECT_NUMBER;
});

describe('ai-proxy App Check', () => {
  it('does not check anything by default (mode off)', async () => {
    const response = await call();
    // Past App Check and the cap, then stopped by the fake failed usage write.
    expect(response.status).toBe(503);
    expect(state.recorded).toBe(1);
  });

  it('enforce: answers 401 app_check without a token, before any quota work', async () => {
    process.env.APP_CHECK_MODE = 'enforce';
    process.env.APP_CHECK_PROJECT_NUMBER = '123456789012';
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'app_check' });
    expect(state.charged).toEqual([]);
    expect(state.recorded).toBe(0);
  });

  it('monitor: lets a request without a token through', async () => {
    process.env.APP_CHECK_MODE = 'monitor';
    process.env.APP_CHECK_PROJECT_NUMBER = '123456789012';
    const response = await call();
    expect(response.status).toBe(503);
    expect(state.recorded).toBe(1);
  });
});

describe('ai-proxy global daily cap', () => {
  it('answers 503 daily_capacity and does not charge the caller', async () => {
    state.charge = { ok: false, reason: 'daily_capacity', count: 11, cap: 10 };
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'daily_capacity' });
    expect(state.charged).toEqual(['text']);
    expect(state.recorded).toBe(0);
  });

  it('charges audio requests as audio', async () => {
    state.charge = { ok: false, reason: 'daily_capacity', count: 11, cap: 10 };
    const response = await handler(
      new Request('https://example.test/api/ai-proxy', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
          config: { responseModalities: ['AUDIO'] },
        }),
      }),
      {}
    );
    expect(response.status).toBe(503);
    expect(state.charged).toEqual(['audio']);
  });
});
