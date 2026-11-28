import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory Firestore with the two rules that matter here: costs and sales
// need their season to exist already, and cannot be written twice.
const fake = vi.hoisted(() => {
  const docs = new Map<string, Record<string, unknown>>();
  let failNextCommit = false;
  let auto = 0;
  const isFixed = (path: string) => /\/(expenses|sales)\//.test(path);
  const parentSeason = (path: string) => path.split('/').slice(0, 4).join('/');
  const check = (path: string, pending: Set<string>) => {
    if (!isFixed(path)) return;
    if (docs.has(path)) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    if (!docs.has(parentSeason(path)) || pending.has(parentSeason(path))) {
      throw Object.assign(new Error('no season'), { code: 'permission-denied' });
    }
  };
  return {
    docs,
    failOnce: () => { failNextCommit = true; },
    module: {
      collection: (_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
      doc: (base: any, ...segs: string[]) =>
        base && typeof base.path === 'string'
          ? { path: `${base.path}/${segs[0] ?? `auto${++auto}`}`, id: segs[0] ?? `auto${auto}` }
          : { path: segs.join('/'), id: segs[segs.length - 1] },
      query: (col: { path: string }) => col,
      where: () => null,
      limit: () => null,
      getDocs: async (q: { path: string }) => ({
        docs: [...docs.entries()]
          .filter(([p]) => p.startsWith(`${q.path}/`) && !p.slice(q.path.length + 1).includes('/'))
          .map(([p, data]) => ({ id: p.split('/').pop(), data: () => data })),
      }),
      setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
        check(ref.path, new Set());
        docs.set(ref.path, data);
      },
      deleteDoc: async (ref: { path: string }) => { docs.delete(ref.path); },
      writeBatch: () => {
        const writes: [string, Record<string, unknown>][] = [];
        return {
          set: (ref: { path: string }, data: Record<string, unknown>) => { writes.push([ref.path, data]); },
          commit: async () => {
            if (failNextCommit) {
              failNextCommit = false;
              throw new Error('offline');
            }
            const pending = new Set(writes.filter(([p]) => !isFixed(p)).map(([p]) => p));
            writes.forEach(([p]) => check(p, pending));
            writes.forEach(([p, data]) => docs.set(p, data));
          },
        };
      },
    },
  };
});

vi.mock('firebase/firestore', () => fake.module);
vi.mock('../firebase', () => ({ auth: { currentUser: null } }));
vi.mock('../firestore', () => ({ db: {} }));

import { hasDeviceRecord, moveDeviceRecordToAccount, withDeviceRecordMoved } from './deviceRecordMove';
import { addSale, savePlot, updateSeasonProgress } from './farmRecord';
import { addExpense, saveSeason, LOCAL_SEASONS_KEY } from './seasons';
import { dhakaDateString } from '../utils/farmTaskDates';

const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

const plan = {
  crop: 'potato',
  landSize: 10,
  landUnit: 'decimal',
  expectedYieldMon: 40,
  expectedPricePerMon: 900,
  plannedCost: 12000,
} as const;

const fillDevice = () => {
  const plot = savePlot(null, { name: 'Home field', landSize: 33, landUnit: 'decimal', tenure: 'own' })!.item;
  const season = saveSeason(null, plan).item;
  updateSeasonProgress(null, season.id, { plotId: plot.id, stage: 'growing' });
  const cost = addExpense(null, season.id, { category: 'seeds', amount: 1500, note: 'seed' }).item;
  const sale = addSale(null, season.id, { quantityMon: 5, pricePerMon: 1000, buyerType: 'trader', date: dhakaDateString() })!.item;
  return { plot, season, cost, sale };
};

beforeEach(() => {
  store.clear();
  fake.docs.clear();
});

describe('moving the phone record into the account', () => {
  it('does nothing when the phone has no record', async () => {
    expect(hasDeviceRecord()).toBe(false);
    expect(await moveDeviceRecordToAccount('u1')).toBe(false);
    expect(fake.docs.size).toBe(0);
  });

  it('copies plots, seasons with progress, costs and sales with their ids, then clears the phone', async () => {
    const { plot, season, cost, sale } = fillDevice();
    expect(await moveDeviceRecordToAccount('u1')).toBe(true);

    expect(fake.docs.get(`users/u1/plots/${plot.id}`)).toMatchObject({ uid: 'u1', name: 'Home field', tenure: 'own' });
    const storedSeason = fake.docs.get(`users/u1/seasons/${season.id}`)!;
    expect(storedSeason).toMatchObject({ uid: 'u1', crop: 'potato', plotId: plot.id, stage: 'growing' });
    expect(storedSeason).not.toHaveProperty('id');
    expect(fake.docs.get(`users/u1/seasons/${season.id}/expenses/${cost.id}`)).toEqual({
      uid: 'u1', seasonId: season.id, category: 'seeds', amount: 1500, note: 'seed', date: cost.date, createdAt: cost.createdAt,
    });
    expect(fake.docs.get(`users/u1/seasons/${season.id}/sales/${sale.id}`)).toMatchObject({ uid: 'u1', quantityMon: 5, pricePerMon: 1000 });

    expect(hasDeviceRecord()).toBe(false);
    expect(store.has(LOCAL_SEASONS_KEY)).toBe(false);
  });

  it('keeps the phone copy when a write fails, and a second run finishes without writing anything twice', async () => {
    fillDevice();
    fake.failOnce();
    await expect(moveDeviceRecordToAccount('u1')).rejects.toThrow('offline');
    expect(hasDeviceRecord()).toBe(true);

    expect(await moveDeviceRecordToAccount('u1')).toBe(true);
    expect(hasDeviceRecord()).toBe(false);
    expect(fake.docs.size).toBe(4);
  });

  it('skips costs and sales the account already has', async () => {
    const { season, cost } = fillDevice();
    // A first run that stored everything but could not clear the phone.
    const saved = new Map(store);
    await moveDeviceRecordToAccount('u1');
    saved.forEach((v, k) => store.set(k, v));

    expect(await moveDeviceRecordToAccount('u1')).toBe(true);
    expect(fake.docs.get(`users/u1/seasons/${season.id}/expenses/${cost.id}`)).toBeDefined();
    expect(fake.docs.size).toBe(4);
  });

  it('withDeviceRecordMoved never throws and does nothing when signed out', async () => {
    fillDevice();
    await withDeviceRecordMoved(null);
    expect(hasDeviceRecord()).toBe(true);
    fake.failOnce();
    await expect(withDeviceRecordMoved('u1')).resolves.toBeUndefined();
    expect(hasDeviceRecord()).toBe(true);
    await withDeviceRecordMoved('u1');
    expect(hasDeviceRecord()).toBe(false);
  });
});
