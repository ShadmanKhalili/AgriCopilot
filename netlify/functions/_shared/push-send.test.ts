import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  /** Every subscription document in the fake database, by id. */
  subscriptions: new Map<string, any>(),
  queries: [] as any[],
  deleted: [] as string[],
  /** Status the fake push service answers per endpoint (default 201). */
  pushStatus: new Map<string, number>(),
  failQueryNo: 0,
  queryNo: 0,
}));

const ROOT = 'projects/p/databases/d/documents/push_subscriptions/';

vi.mock('./service-account.ts', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    serviceAccountConfigured: () => true,
    adminFetch: async (path: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'DELETE') {
        state.deleted.push(decodeURIComponent(path.split('/').pop() ?? ''));
        return new Response('{}', { status: 200 });
      }
      const query = JSON.parse(init?.body ?? '{}').structuredQuery;
      state.queries.push(query);
      state.queryNo += 1;
      if (state.failQueryNo === state.queryNo) return new Response('{}', { status: 500 });
      const filter = query.where.fieldFilter;
      const wanted = filter.value.stringValue;
      let rows = [...state.subscriptions.entries()]
        .filter(([, data]) => data[filter.field.fieldPath] === wanted)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1));
      if (query.startAt) {
        const after = String(query.startAt.values[0].referenceValue);
        rows = rows.filter(([id]) => `${ROOT}${id}` > after);
      }
      rows = rows.slice(0, query.limit);
      if (rows.length === 0) return new Response(JSON.stringify([{ readTime: 'x' }]), { status: 200 });
      return new Response(
        JSON.stringify(
          rows.map(([id, data]) => ({
            document: {
              name: `${ROOT}${id}`,
              fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { stringValue: String(v) }])),
            },
          }))
        ),
        { status: 200 }
      );
    },
  };
});

vi.mock('./web-push-crypto.ts', () => ({
  readVapidKeys: () => ({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:x@example.test' }),
  buildPushRequest: (subscription: any) => ({
    url: subscription.endpoint,
    init: { method: 'POST', headers: {}, body: new Uint8Array([1]) },
  }),
}));

import {
  MAX_SUBSCRIPTIONS_PER_AREA,
  PAGE_SIZE,
  findSubscriptions,
  sendPushToArea,
  type PushMessage,
} from './push-send.ts';

const message: PushMessage = { titleBn: 'শিরোনাম', titleEn: 'Title', bodyBn: 'বার্তা', bodyEn: 'Body', url: '/#community-radar' };

const addSubscription = (i: number, areaKey = 'pabna__ishurdi') => {
  const id = `s${String(i).padStart(5, '0')}`;
  state.subscriptions.set(id, {
    areaKey,
    uid: `u${i}`,
    endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
    p256dh: 'p'.repeat(40),
    auth: 'a'.repeat(16),
    lang: 'en',
  });
  return id;
};

beforeEach(() => {
  state.subscriptions.clear();
  state.queries = [];
  state.deleted = [];
  state.pushStatus.clear();
  state.failQueryNo = 0;
  state.queryNo = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => new Response('', { status: state.pushStatus.get(url) ?? 201 }))
  );
});

describe('findSubscriptions paging', () => {
  it('reads every subscription of an area, page by page, past the old limit of 500', async () => {
    for (let i = 0; i < 1250; i += 1) addSubscription(i);
    addSubscription(9999, 'dhaka__savar');
    const found = await findSubscriptions('areaKey', 'pabna__ishurdi');
    expect(found).toHaveLength(1250);
    expect(new Set(found.map((s) => s.id)).size).toBe(1250);
    // 300 + 300 + 300 + 300 + 50.
    expect(state.queries).toHaveLength(5);
    expect(state.queries[0].limit).toBe(PAGE_SIZE);
  });

  it('orders by document name and continues each page after the last name of the one before', async () => {
    for (let i = 0; i < PAGE_SIZE + 5; i += 1) addSubscription(i);
    await findSubscriptions('areaKey', 'pabna__ishurdi');
    expect(state.queries[0].orderBy).toEqual([{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }]);
    expect(state.queries[0].startAt).toBeUndefined();
    expect(state.queries[1].startAt).toEqual({
      values: [{ referenceValue: `${ROOT}s${String(PAGE_SIZE - 1).padStart(5, '0')}` }],
      before: false,
    });
  });

  it('stops after one query when the first page is not full, and when there is nothing', async () => {
    addSubscription(1);
    expect(await findSubscriptions('areaKey', 'pabna__ishurdi')).toHaveLength(1);
    expect(state.queries).toHaveLength(1);
    expect(await findSubscriptions('areaKey', 'nobody__here')).toEqual([]);
  });

  it('needs one more query when the last page is exactly full, and finds nothing on it', async () => {
    for (let i = 0; i < PAGE_SIZE; i += 1) addSubscription(i);
    expect(await findSubscriptions('areaKey', 'pabna__ishurdi')).toHaveLength(PAGE_SIZE);
    expect(state.queries).toHaveLength(2);
  });

  it('caps the list, never reads more than one past the cap, and logs a count without any endpoint', async () => {
    for (let i = 0; i < 700; i += 1) addSubscription(i);
    const found = await findSubscriptions('areaKey', 'pabna__ishurdi', 650);
    expect(found).toHaveLength(650);
    const asked = state.queries.reduce((sum, q) => sum + q.limit, 0);
    expect(asked).toBe(651);
    const logged = (console.warn as any).mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(logged).toContain('650');
    expect(logged).not.toContain('fcm.googleapis.com');
  });

  it('has a sane default cap per area', () => {
    expect(MAX_SUBSCRIPTIONS_PER_AREA).toBe(5000);
  });

  it('keeps what it has read when a later page fails, and gives an empty list when the first fails', async () => {
    for (let i = 0; i < PAGE_SIZE * 2; i += 1) addSubscription(i);
    state.failQueryNo = 2;
    expect(await findSubscriptions('areaKey', 'pabna__ishurdi')).toHaveLength(PAGE_SIZE);
    state.queryNo = 0;
    state.failQueryNo = 1;
    expect(await findSubscriptions('areaKey', 'pabna__ishurdi')).toEqual([]);
  });

  it('skips documents that are not push-service addresses', async () => {
    addSubscription(1);
    state.subscriptions.set('s00002', { ...state.subscriptions.get('s00001'), endpoint: 'https://evil.example/hook' });
    const found = await findSubscriptions('areaKey', 'pabna__ishurdi');
    expect(found.map((s) => s.id)).toEqual(['s00001']);
  });
});

describe('sendPushToArea', () => {
  beforeEach(() => {
    process.env.FIREBASE_SERVICE_ACCOUNT = 'set';
  });

  it('sends to every phone of the area across pages and deletes the ones the push service says are gone', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 700; i += 1) ids.push(addSubscription(i));
    for (const gone of [ids[3], ids[400], ids[699]]) {
      state.pushStatus.set(`https://fcm.googleapis.com/fcm/send/${gone}`, gone === ids[400] ? 404 : 410);
    }
    const sent = await sendPushToArea('pabna__ishurdi', message);
    expect(sent).toBe(697);
    expect(state.deleted.sort()).toEqual([ids[3], ids[400], ids[699]].sort());
    expect((fetch as any).mock.calls).toHaveLength(700);
  });

  it('does not delete a subscription for an ordinary failure such as 500', async () => {
    const id = addSubscription(1);
    state.pushStatus.set(`https://fcm.googleapis.com/fcm/send/${id}`, 500);
    expect(await sendPushToArea('pabna__ishurdi', message)).toBe(0);
    expect(state.deleted).toEqual([]);
  });

  it('refuses an area key that is not plain letters, digits and underscores', async () => {
    addSubscription(1);
    expect(await sendPushToArea('pabna__ishurdi" OR 1=1', message)).toBe(0);
    expect(state.queries).toHaveLength(0);
  });
});
