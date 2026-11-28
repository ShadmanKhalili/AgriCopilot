import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  configured: true,
  user: { uid: 'farmer-1', email: null, emailVerified: true, isGuest: false } as any,
  // The stored score document, or null for "not stored yet".
  existing: null as any,
  readStatus: 200,
  writeStatus: 200,
  writes: [] as any[],
}));

vi.mock('./_shared/auth.ts', () => ({
  authenticate: async () => ({ user: state.user }),
}));

vi.mock('./_shared/record-facts.ts', () => ({
  gatherFarmRecordFacts: async () => ({
    plots: 1,
    seasons: 1,
    seasonsWithProgress: 1,
    expenseCount: 2,
    salesCount: 0,
    diagnosisCount: 0,
    monthsWithActivity: 1,
    windowStart: '2025-12-01',
    windowEnd: '2026-11-28',
  }),
}));

vi.mock('./_shared/service-account.ts', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    serviceAccountConfigured: () => state.configured,
    adminFetch: async (path: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'PATCH') {
        state.writes.push(JSON.parse(init.body ?? '{}'));
        return new Response('{}', { status: state.writeStatus });
      }
      if (state.readStatus !== 200) return new Response('{}', { status: state.readStatus });
      if (!state.existing) return new Response('{"error":{}}', { status: 404 });
      return new Response(JSON.stringify({ name: path, fields: state.existing }), { status: 200 });
    },
  };
});

import handler from './farm-record-score';
import { toFirestoreValue } from './_shared/service-account.ts';

const post = () => new Request('https://example.test/api/farm-record-score', { method: 'POST' });

const storedFields = (computedAt: string, version = 1) =>
  Object.fromEntries(
    Object.entries({
      uid: 'farmer-1',
      score: 42,
      level: 'building',
      pillars: [],
      facts: {},
      computedAt,
      version,
    }).map(([key, value]) => [key, toFirestoreValue(value)])
  );

beforeEach(() => {
  state.configured = true;
  state.user = { uid: 'farmer-1', email: null, emailVerified: true, isGuest: false };
  state.existing = null;
  state.readStatus = 200;
  state.writeStatus = 200;
  state.writes = [];
});

describe('farm-record-score handler', () => {
  it('answers 405 for anything but POST', async () => {
    const response = await handler(new Request('https://example.test/api/farm-record-score', { method: 'GET' }));
    expect(response.status).toBe(405);
  });

  it('answers 503 when the server has no service account', async () => {
    state.configured = false;
    const response = await handler(post());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'not_configured' });
  });

  it('answers 401 when signed out and 403 for a guest account', async () => {
    state.user = null;
    expect((await handler(post())).status).toBe(401);
    state.user = { uid: 'g', email: null, emailVerified: false, isGuest: true };
    expect((await handler(post())).status).toBe(403);
  });

  it('calculates and stores a new score for a first request', async () => {
    const response = await handler(post());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.score.uid).toBe('farmer-1');
    expect(typeof body.score.score).toBe('number');
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].fields.uid).toEqual({ stringValue: 'farmer-1' });
  });

  it('returns the stored score with 429 when it was calculated less than 10 minutes ago', async () => {
    state.existing = storedFields(new Date(Date.now() - 2 * 60_000).toISOString());
    const response = await handler(post());
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe('too_soon');
    expect(body.score.score).toBe(42);
    expect(state.writes).toHaveLength(0);
  });

  it('recalculates when the stored score is older than the interval', async () => {
    state.existing = storedFields(new Date(Date.now() - 30 * 60_000).toISOString());
    const response = await handler(post());
    expect(response.status).toBe(200);
    expect(state.writes).toHaveLength(1);
  });

  it('recalculates when the stored score is from an older version', async () => {
    state.existing = storedFields(new Date().toISOString(), 0);
    expect((await handler(post())).status).toBe(200);
  });

  it('answers 502 when the stored score cannot be read', async () => {
    state.readStatus = 500;
    const response = await handler(post());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'store_failed' });
    expect(state.writes).toHaveLength(0);
  });

  it('answers 502 when the write is refused', async () => {
    state.writeStatus = 403;
    const response = await handler(post());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'store_failed' });
  });
});
