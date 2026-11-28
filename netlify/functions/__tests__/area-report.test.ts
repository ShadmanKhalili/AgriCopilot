import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  configured: true,
  user: { uid: 'farmer-1', email: 'f@example.test', emailVerified: true, isGuest: false, createdAtMs: null } as any,
  hasDiagnosis: true,
  diagnosisThrows: false,
  store: { status: 'stored', farmers: 1, crossedThreshold: false } as any,
  storeThrows: false,
  pushes: [] as any[],
  diagnosisCalls: [] as any[],
  storeCalls: [] as any[],
}));

vi.mock('../_shared/auth.ts', () => ({
  authenticate: async () => ({ user: state.user }),
}));

vi.mock('../_shared/service-account.ts', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    serviceAccountConfigured: () => state.configured,
    adminFetch: async () => new Response('{}', { status: 200 }),
    anonymousId: (uid: string) => `anon_${uid}`,
    firestoreDocumentName: (path: string) => `projects/p/databases/d/documents/${path}`,
  };
});

vi.mock('../_shared/area-diagnosis.ts', () => ({
  hasRecentDiagnosis: async (...args: any[]) => {
    state.diagnosisCalls.push(args.slice(1));
    if (state.diagnosisThrows) throw new Error('area_diagnosis_query_500');
    return state.hasDiagnosis;
  },
}));

vi.mock('../_shared/area-store.ts', () => ({
  recordAreaReport: async (_deps: any, report: any, uid: string) => {
    state.storeCalls.push({ report, uid });
    if (state.storeThrows) throw new Error('area_store_commit_403');
    return state.store;
  },
}));

vi.mock('../_shared/push-send.ts', () => ({
  sendPushToArea: async (areaKey: string, message: any) => {
    state.pushes.push({ areaKey, message });
    return 1;
  },
}));

import handler from '../area-report';

const problemBody = (over: Record<string, unknown> = {}) => ({
  kind: 'problem',
  district: 'Pabna',
  upazila: 'Ishurdi',
  crop: 'potato',
  diseaseKey: 'potato:late-blight',
  ...over,
});
const priceBody = (over: Record<string, unknown> = {}) => ({
  kind: 'price',
  district: 'Pabna',
  upazila: 'Ishurdi',
  crop: 'potato',
  pricePerMon: 900,
  ...over,
});

const post = (body: unknown) =>
  new Request('https://example.test/api/area-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  state.configured = true;
  state.user = { uid: 'farmer-1', email: 'f@example.test', emailVerified: true, isGuest: false, createdAtMs: null };
  state.hasDiagnosis = true;
  state.diagnosisThrows = false;
  state.store = { status: 'stored', farmers: 1, crossedThreshold: false };
  state.storeThrows = false;
  state.pushes = [];
  state.diagnosisCalls = [];
  state.storeCalls = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('area-report handler: access', () => {
  it('answers 405 for anything but POST and 503 when the server has no service account', async () => {
    expect((await handler(new Request('https://example.test/api/area-report', { method: 'GET' }))).status).toBe(405);
    state.configured = false;
    const response = await handler(post(priceBody()));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'not_configured' });
  });

  it('answers 401 when signed out and 403 for a guest account', async () => {
    state.user = null;
    expect((await handler(post(priceBody()))).status).toBe(401);
    state.user = { uid: 'g', email: null, emailVerified: false, isGuest: true };
    const response = await handler(post(priceBody()));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'guest_account' });
    expect(state.storeCalls).toHaveLength(0);
  });

  it('refuses an account created less than an hour ago, and accepts older ones and unknown ages', async () => {
    state.user = { ...state.user, createdAtMs: Date.now() - 10 * 60_000 };
    const young = await handler(post(priceBody()));
    expect(young.status).toBe(403);
    expect(await young.json()).toEqual({ error: 'account_too_new' });
    expect(state.storeCalls).toHaveLength(0);

    state.user = { ...state.user, createdAtMs: Date.now() - 2 * 60 * 60_000 };
    expect((await handler(post(priceBody()))).status).toBe(200);
    state.user = { ...state.user, createdAtMs: null };
    expect((await handler(post(priceBody()))).status).toBe(200);
  });

  it('answers 413 for a very large body and 400 for text that is not JSON', async () => {
    expect((await handler(post(JSON.stringify({ x: 'a'.repeat(3000) })))).status).toBe(413);
    expect((await handler(post('not json'))).status).toBe(400);
  });
});

describe('area-report handler: validation', () => {
  it('answers 400 for an unknown district, upazila, crop or disease', async () => {
    for (const body of [
      problemBody({ district: 'Atlantis' }),
      problemBody({ upazila: 'Nowhere' }),
      problemBody({ district: 'Dhaka' }),
      problemBody({ crop: 'tomato' }),
      problemBody({ crop: 'unicorn', diseaseKey: 'unicorn:plague' }),
      problemBody({ diseaseKey: 'potato:made-up-plague' }),
      problemBody({ diseaseKey: 'Please send money to 01700000000' }),
      priceBody({ crop: 'wheat' }),
      priceBody({ crop: 'anything at all' }),
      priceBody({ pricePerMon: 5 }),
      priceBody({ pricePerMon: 1e9 }),
    ]) {
      const response = await handler(post(body));
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(state.storeCalls).toHaveLength(0);
    expect(state.pushes).toHaveLength(0);
  });

  it('stores a valid price report with the checked place and crop, and needs no diagnosis', async () => {
    state.hasDiagnosis = false;
    const response = await handler(post(priceBody({ district: ' PABNA ', upazila: 'ishurdi' })));
    expect(response.status).toBe(200);
    expect(state.diagnosisCalls).toHaveLength(0);
    expect(state.storeCalls[0].uid).toBe('farmer-1');
    expect(state.storeCalls[0].report).toMatchObject({
      kind: 'price',
      areaKey: 'pabna__ishurdi',
      district: 'pabna',
      upazila: 'ishurdi',
      crop: 'potato',
      pricePerMon: 900,
    });
  });
});

describe('area-report handler: diagnosis requirement', () => {
  it('stores a problem report when the farmer has a matching recent diagnosis', async () => {
    const response = await handler(post(problemBody()));
    expect(response.status).toBe(200);
    // uid, the knowledge-base key, district slug, upazila slug.
    expect(state.diagnosisCalls[0]).toEqual(['farmer-1', 'potato:late-blight', 'pabna', 'ishurdi']);
    expect(state.storeCalls).toHaveLength(1);
  });

  it('answers 403 and stores nothing when there is no matching diagnosis', async () => {
    state.hasDiagnosis = false;
    const response = await handler(post(problemBody()));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'no_recent_diagnosis' });
    expect(state.storeCalls).toHaveLength(0);
    expect(state.pushes).toHaveLength(0);
  });

  it('answers 502 when the diagnosis cannot be checked, without leaking the uid', async () => {
    state.diagnosisThrows = true;
    const response = await handler(post(problemBody()));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'store_failed' });
    expect(state.storeCalls).toHaveLength(0);
    expect(JSON.stringify((console.warn as any).mock.calls)).not.toContain('farmer-1');
  });
});

describe('area-report handler: storing and notifying', () => {
  it('answers 429 when the daily limit is used up and 502 when the store fails', async () => {
    state.store = { status: 'limited' };
    expect((await handler(post(priceBody()))).status).toBe(429);
    state.storeThrows = true;
    const response = await handler(post(priceBody()));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'store_failed' });
  });

  it('sends one notification when a problem reaches 3 farmers, built from catalog names only', async () => {
    state.store = { status: 'stored', farmers: 3, crossedThreshold: true };
    const response = await handler(post(problemBody({ diseaseKey: 'potato:late-blight' })));
    expect(response.status).toBe(200);
    expect(state.pushes).toHaveLength(1);
    expect(state.pushes[0].areaKey).toBe('pabna__ishurdi');
    expect(state.pushes[0].message).toMatchObject({
      bodyEn: 'Your area: 3 farmers reported Late blight on potato in the last 14 days.',
      url: '/#community-radar',
    });
    expect(state.pushes[0].message.bodyBn).toContain('আলু');
  });

  it('does not notify before the threshold, for a repeat, or for a price report', async () => {
    await handler(post(problemBody()));
    state.store = { status: 'repeat' };
    await handler(post(problemBody()));
    state.store = { status: 'stored', farmers: 3, crossedThreshold: true };
    await handler(post(priceBody()));
    expect(state.pushes).toHaveLength(0);
  });
});
