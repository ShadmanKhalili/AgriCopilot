import { beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL,
  COOLDOWN_MS,
  buildProbeBody,
  buildReport,
  checkCooldown,
  createGeminiProbe,
  describeFailure,
  isAdminUser,
  planChecks,
  recordRun,
  PER_CALL_TIMEOUT_MS,
  TOTAL_BUDGET_MS,
  CONCURRENCY,
  resetCooldownForTests,
  runModelChecks,
  type CheckSpec,
  type Probe,
} from './model-check.ts';

const KEY = 'AIzaSyFAKE-KEY-FOR-TESTS-0123456789abcd';

describe('isAdminUser', () => {
  it('accepts only the verified administrator email', () => {
    expect(isAdminUser({ email: ADMIN_EMAIL, emailVerified: true })).toBe(true);
    expect(isAdminUser({ email: ADMIN_EMAIL.toUpperCase(), emailVerified: true })).toBe(true);
  });

  it('refuses an unverified email, another email, a guest and nobody', () => {
    expect(isAdminUser({ email: ADMIN_EMAIL, emailVerified: false })).toBe(false);
    expect(isAdminUser({ email: 'someone@example.com', emailVerified: true })).toBe(false);
    expect(isAdminUser({ email: null, emailVerified: true })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });
});

describe('planChecks', () => {
  it('has one text check per model, one search check and one speech check', () => {
    const plan = planChecks();
    expect(plan.filter((c) => c.feature === 'text').map((c) => c.model)).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-2.5-flash',
    ]);
    expect(plan.filter((c) => c.feature === 'search')).toEqual([{ model: 'gemini-3.6-flash', feature: 'search' }]);
    expect(plan.filter((c) => c.feature === 'tts')).toEqual([{ model: 'gemini-3.8-flash-lite-tts', feature: 'tts' }]);
  });
});

describe('buildProbeBody', () => {
  it('keeps text calls tiny and adds the search tool only to the search call', () => {
    const text: any = buildProbeBody({ model: 'm', feature: 'text' });
    const search: any = buildProbeBody({ model: 'm', feature: 'search' });
    expect(text.contents[0].parts[0].text).toBe('Reply with OK');
    expect(text.generationConfig.maxOutputTokens).toBeLessThanOrEqual(64);
    expect(text.tools).toBeUndefined();
    expect(search.tools).toEqual([{ googleSearch: {} }]);
  });

  it('asks the speech call for audio with a one-word text', () => {
    const tts: any = buildProbeBody({ model: 'm', feature: 'tts' });
    expect(tts.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(tts.contents[0].parts[0].text.split(/\s+/)).toHaveLength(1);
  });
});

describe('runModelChecks', () => {
  const specs: CheckSpec[] = [
    { model: 'a', feature: 'text' },
    { model: 'b', feature: 'text' },
    { model: 'c', feature: 'search' },
    { model: 'd', feature: 'tts' },
  ];

  it('shapes passes and failures, keeping the order of the plan', async () => {
    const probe: Probe = async (spec) => {
      if (spec.model === 'a') return { status: 200, hasOutput: true };
      if (spec.model === 'b') return { status: 404, errorStatus: 'NOT_FOUND' };
      if (spec.model === 'c') return { status: 400, errorStatus: 'INVALID_ARGUMENT' };
      return { status: 200, hasOutput: true };
    };
    const results = await runModelChecks(probe, specs);
    expect(results.map((r) => r.model)).toEqual(['a', 'b', 'c', 'd']);
    expect(results[0]).toMatchObject({ ok: true, status: 200, feature: 'text' });
    expect(results[0].errorCode).toBeUndefined();
    expect(results[1]).toMatchObject({ ok: false, status: 404, errorCode: 'NOT_FOUND' });
    expect(results[1].message).toMatch(/not found/i);
    expect(results[2]).toMatchObject({ ok: false, status: 400, errorCode: 'INVALID_ARGUMENT' });
    expect(results[2].message).toMatch(/Google Search/);
    expect(results[3].ok).toBe(true);
    for (const r of results) expect(typeof r.latencyMs).toBe('number');
  });

  it('counts a 200 text answer as working even when the short answer is empty', async () => {
    const results = await runModelChecks(async () => ({ status: 200, hasOutput: false }), [specs[0]]);
    expect(results[0].ok).toBe(true);
  });

  it('fails a speech call that returns no audio', async () => {
    const results = await runModelChecks(async () => ({ status: 200, hasOutput: false }), [specs[3]]);
    expect(results[0]).toMatchObject({ ok: false, status: 200, errorCode: 'empty' });
  });

  it('uses a code from the status when the provider sent no plain word', async () => {
    const results = await runModelChecks(async () => ({ status: 503, errorStatus: null }), [specs[0]]);
    expect(results[0]).toMatchObject({ ok: false, errorCode: 'HTTP_503' });
    expect(results[0].message).toMatch(/temporary/i);
  });

  it('reports a network failure and a timeout separately', async () => {
    const failing: Probe = async () => {
      throw new Error(`socket hang up for key ${KEY}`);
    };
    const hanging: Probe = (_spec, signal) =>
      new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));

    const net = await runModelChecks(failing, [specs[0]]);
    expect(net[0]).toMatchObject({ ok: false, status: null, errorCode: 'network' });
    // The thrown text never reaches the result.
    expect(JSON.stringify(net)).not.toContain(KEY);

    const slow = await runModelChecks(hanging, [specs[0]], { perCallTimeoutMs: 20 });
    expect(slow[0]).toMatchObject({ ok: false, status: null, errorCode: 'timeout' });
  });

  it('never runs more calls at once than the concurrency allows', async () => {
    let inFlight = 0;
    let peak = 0;
    const probe: Probe = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { status: 200, hasOutput: true };
    };
    const many: CheckSpec[] = Array.from({ length: 8 }, (_, i) => ({ model: `m${i}`, feature: 'text' as const }));
    const results = await runModelChecks(probe, many, { concurrency: 2 });
    expect(results).toHaveLength(8);
    expect(peak).toBe(2);
  });

  it('skips checks that would start after the total budget is spent', async () => {
    let clock = 0;
    const probe: Probe = async () => {
      clock += 10_000;
      return { status: 200, hasOutput: true };
    };
    const results = await runModelChecks(probe, specs, {
      concurrency: 1,
      totalBudgetMs: 15_000,
      now: () => clock,
    });
    expect(results.map((r) => r.ok)).toEqual([true, true, false, false]);
    expect(results[2]).toMatchObject({ status: null, errorCode: 'skipped' });
    expect(results[3].errorCode).toBe('skipped');
  });
});

describe('run limits', () => {
  it('fits all checks in one parallel round under the 10 s function limit', () => {
    expect(TOTAL_BUDGET_MS).toBeLessThan(10_000);
    expect(PER_CALL_TIMEOUT_MS).toBeLessThanOrEqual(TOTAL_BUDGET_MS);
    expect(CONCURRENCY).toBeGreaterThanOrEqual(planChecks().length);
  });

  it('starts every planned check at once and reports hung ones as timed out', async () => {
    let started = 0;
    const probe: Probe = (_spec, signal) =>
      new Promise((_resolve, reject) => {
        started += 1;
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const plan = planChecks();
    const results = await runModelChecks(probe, plan, { perCallTimeoutMs: 20 });
    expect(started).toBe(plan.length);
    expect(results.every((r) => r.errorCode === 'timeout' && !r.ok)).toBe(true);
  });
});

describe('describeFailure', () => {
  it('never uses provider text and always gives a sentence', () => {
    expect(describeFailure('text', 404, 'NOT_FOUND')).toMatch(/not found/i);
    expect(describeFailure('text', 403, 'PERMISSION_DENIED')).toMatch(/key/i);
    expect(describeFailure('text', 429, 'RESOURCE_EXHAUSTED')).toMatch(/quota/i);
    expect(describeFailure('text', null, 'timeout')).toMatch(/in time/i);
    expect(describeFailure('text', 418, 'HTTP_418')).toBe('The call failed.');
  });
});

describe('createGeminiProbe', () => {
  const jsonFetch = (status: number, body: unknown, seen?: { url?: string; init?: RequestInit }) =>
    (async (url: any, init?: RequestInit) => {
      if (seen) {
        seen.url = String(url);
        seen.init = init;
      }
      return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;

  it('sends the key in a header, not in the URL, and never in the outcome', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const probe = createGeminiProbe(
      KEY,
      jsonFetch(200, { candidates: [{ content: { parts: [{ text: 'OK' }] } }] }, seen)
    );
    const outcome = await probe({ model: 'gemini-3.6-flash', feature: 'text' }, new AbortController().signal);
    expect(seen.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
    expect(seen.url).not.toContain(KEY);
    expect((seen.init?.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    expect(outcome).toEqual({ status: 200, hasOutput: true });
  });

  it('reduces a provider error to its status and a plain status word', async () => {
    const probe = createGeminiProbe(
      KEY,
      jsonFetch(404, {
        error: { code: 404, status: 'NOT_FOUND', message: `models/x is no longer available, key=${KEY}` },
      })
    );
    const outcome = await probe({ model: 'gemini-3.8-flash', feature: 'text' }, new AbortController().signal);
    expect(outcome).toEqual({ status: 404, errorStatus: 'NOT_FOUND' });
    expect(JSON.stringify(outcome)).not.toContain(KEY);
  });

  it('drops a status word that is not a plain code', async () => {
    const probe = createGeminiProbe(KEY, jsonFetch(400, { error: { status: `bad ${KEY}` } }));
    const outcome = await probe({ model: 'm', feature: 'search' }, new AbortController().signal);
    expect(outcome).toEqual({ status: 400, errorStatus: null });
  });

  it('reads audio from a speech answer', async () => {
    const probe = createGeminiProbe(
      KEY,
      jsonFetch(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16', data: 'AAAA' } }] } }] })
    );
    const outcome = await probe({ model: 'gemini-3.8-flash-lite-tts', feature: 'tts' }, new AbortController().signal);
    expect(outcome).toEqual({ status: 200, hasOutput: true });
  });
});

describe('buildReport', () => {
  it('counts passes and failures and stamps the time', () => {
    const report = buildReport(
      [
        { model: 'a', feature: 'text', ok: true, status: 200, latencyMs: 10 },
        { model: 'b', feature: 'text', ok: false, status: 404, latencyMs: 12, errorCode: 'NOT_FOUND', message: 'x' },
      ],
      new Date('2026-11-28T06:00:00Z')
    );
    expect(report).toMatchObject({ passed: 1, failed: 1, checkedAt: '2026-11-28T06:00:00.000Z' });
  });
});

describe('checkCooldown', () => {
  beforeEach(() => resetCooldownForTests());

  it('allows one run a minute per user', () => {
    expect(checkCooldown('u1', 1_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    // Checking alone does not start the cooldown.
    expect(checkCooldown('u1', 1_500)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    recordRun('u1', 1_000);
    const second = checkCooldown('u1', 1_000 + 20_000);
    expect(second).toEqual({ allowed: false, retryAfterSeconds: 40 });
    expect(checkCooldown('u2', 1_000 + 20_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(checkCooldown('u1', 1_000 + COOLDOWN_MS)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});
