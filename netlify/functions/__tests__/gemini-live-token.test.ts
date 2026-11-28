import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    authTokens = { create };
  },
}));

vi.mock('../_shared/auth.ts', () => ({
  extractBearerTokenFromHeader: (h?: string) => (h ? h.replace(/^Bearer /, '') : null),
  verifyIdToken: vi.fn(async () => ({ uid: 'u1', isGuest: false })),
}));

vi.mock('../_shared/usage-quota.ts', () => ({
  countAiUsageToday: vi.fn(async () => 0),
  dailyAiLimit: vi.fn(() => 100),
  dailyLimitMessage: vi.fn(() => 'daily limit'),
  dailyLiveSessionLimit: vi.fn(() => 10),
  getUserPlan: vi.fn(async () => 'free'),
  recordAiUsage: vi.fn(async () => true),
  utcDayNumber: vi.fn(() => 20000),
  chargeGlobalAiCall: vi.fn(async () => ({ ok: true, enabled: false })),
}));

import { handler } from '../gemini-live-token.ts';

const call = (body: unknown, method = 'POST') =>
  (handler as any)(
    {
      httpMethod: method,
      headers: { authorization: 'Bearer id-token', 'x-nf-client-connection-ip': '203.0.113.9' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      isBase64Encoded: false,
    },
    {}
  );

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  create.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('gemini-live-token handler', () => {
  it('refuses a non-POST method', async () => {
    const res = await call({}, 'GET');
    expect(res.statusCode).toBe(405);
  });

  it('answers a Gemini failure with a generic message and never echoes the raw error', async () => {
    create.mockRejectedValue(new Error('PERMISSION_DENIED: key AIzaSySECRET123 has been suspended'));
    const res = await call({ kind: 'video', mode: 'quick', lang: 'en' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toMatch(/AIzaSy|SECRET|suspended|PERMISSION_DENIED/);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('LIVE_FAILED');
    expect(body.error).toBe('Could not start the live session. Please try again.');
  });

  it('answers in Bangla when the caller asks for it', async () => {
    create.mockRejectedValue(new Error('boom'));
    const res = await call({ kind: 'voice', lang: 'bn' });
    expect(JSON.parse(res.body).error).toMatch(/[ঀ-৿]/);
  });

  it('returns the token for a valid request and passes the locked constraints to Gemini', async () => {
    create.mockResolvedValue({ name: 'auth_tokens/xyz' });
    const res = await call({ kind: 'video', mode: 'quick', lang: 'bn', farmContext: 'Rice' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).token).toBe('auth_tokens/xyz');
    const params = create.mock.calls[0][0];
    expect(params.config.liveConnectConstraints.config.systemInstruction).toContain('Rice');
    expect(params.config.lockAdditionalFields).toContain('tools');
  });

  it('locks compression but not session resumption in the token', async () => {
    create.mockResolvedValue({ name: 'auth_tokens/xyz' });
    await call({ kind: 'video', mode: 'quick', lang: 'bn' });
    const params = create.mock.calls[0][0];
    const cfg = params.config.liveConnectConstraints.config;
    expect(cfg.contextWindowCompression.slidingWindow).toBeDefined();
    expect(cfg.sessionResumption).toBeUndefined();
    expect(params.config.lockAdditionalFields).not.toContain('sessionResumption');
  });

  it('rejects invalid JSON and bad inputs without calling Gemini', async () => {
    const bad = await call('{not json');
    expect(bad.statusCode).toBe(400);
    const missingKind = await call({ mode: 'quick' });
    expect(missingKind.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an oversized body', async () => {
    const res = await call({ kind: 'video', farmContext: 'x'.repeat(20_000) });
    expect(res.statusCode).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  it('answers 503 without minting a token when the app-wide daily cap is used up', async () => {
    const quota = await import('../_shared/usage-quota.ts');
    (quota.chargeGlobalAiCall as any).mockResolvedValueOnce({ ok: false, reason: 'daily_capacity', count: 10, cap: 10 });
    const res = await call({ kind: 'video', lang: 'en' });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).code).toBe('daily_capacity');
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses a missing App Check token when enforcement is on', async () => {
    process.env.APP_CHECK_MODE = 'enforce';
    process.env.APP_CHECK_PROJECT_NUMBER = '123';
    try {
      const res = await call({ kind: 'video', lang: 'en' });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).code).toBe('app_check');
      expect(create).not.toHaveBeenCalled();
    } finally {
      delete process.env.APP_CHECK_MODE;
      delete process.env.APP_CHECK_PROJECT_NUMBER;
    }
  });
});
