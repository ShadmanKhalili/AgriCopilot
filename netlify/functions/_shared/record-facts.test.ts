import { describe, expect, it } from 'vitest';
import { gatherFarmRecordFacts, lastTwelveMonths, type RecordFactsDeps } from './record-facts.ts';
import { toFirestoreValue } from './service-account.ts';

// 2026-11-28 12:00 in Dhaka. The 12-month window is 2025-12 .. 2026-11.
const NOW = new Date('2026-11-28T06:00:00Z');

const fields = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));
const doc = (path: string, data: Record<string, unknown>) => ({ name: `projects/p/databases/d/documents/${path}`, fields: fields(data) });
const stamp = (iso: string) => ({ timestampValue: iso });

interface Fake {
  plots?: any[];
  seasons?: any[];
  /** seasonId -> docs */
  expenses?: Record<string, any[]>;
  sales?: Record<string, any[]>;
  /** createdAt ISO strings (or anything, for malformed ones) */
  diagnoses?: any[];
  failOn?: string;
}

const makeDeps = (fake: Fake) => {
  const calls: Array<{ path: string; body?: any }> = [];
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  const adminFetch: RecordFactsDeps['adminFetch'] = async (path, init) => {
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (fake.failOn && path.includes(fake.failOn)) return json({ error: 'x' }, 503);
    if (path === '/documents:runQuery') {
      const rows = (fake.diagnoses ?? []).map((createdAt, i) => ({
        document: { name: `projects/p/databases/d/documents/diagnoses/d${i}`, fields: { createdAt } },
      }));
      return json(rows.length ? rows : [{ readTime: 'x' }]);
    }
    const [pathOnly] = path.split('?');
    const parts = pathOnly.split('/').map(decodeURIComponent); // '', 'documents', 'users', uid, ...
    const last = parts[parts.length - 1];
    if (last === 'plots') return json(fake.plots?.length ? { documents: fake.plots } : {});
    if (last === 'seasons') return json(fake.seasons?.length ? { documents: fake.seasons } : {});
    if (last === 'expenses') {
      const list = fake.expenses?.[parts[parts.length - 2]];
      return json(list?.length ? { documents: list } : {});
    }
    if (last === 'sales') {
      const list = fake.sales?.[parts[parts.length - 2]];
      return json(list?.length ? { documents: list } : {});
    }
    return json({}, 404);
  };
  return { deps: { adminFetch } as RecordFactsDeps, calls };
};

const season = (id: string, extra: Record<string, unknown> = {}) =>
  doc(`users/u1/seasons/${id}`, { uid: 'u1', crop: 'rice', landSize: 1, landUnit: 'bigha', ...extra });
const expense = (seasonId: string, id: string, date: string, amount: unknown = 500) =>
  doc(`users/u1/seasons/${seasonId}/expenses/${id}`, { amount, date, category: 'seeds' });
const sale = (seasonId: string, id: string, date: string) =>
  doc(`users/u1/seasons/${seasonId}/sales/${id}`, { quantityMon: 10, pricePerMon: 1000, date, buyerType: 'trader' });

describe('lastTwelveMonths', () => {
  it('holds the current Dhaka month and the 11 before it, across a year end', () => {
    const months = [...lastTwelveMonths(NOW)].sort();
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2025-12');
    expect(months[11]).toBe('2026-11');
  });

  it('uses Dhaka time at the edge of a month', () => {
    // 18:30 UTC on 31 Oct is already 1 Nov in Dhaka.
    expect(lastTwelveMonths(new Date('2026-10-31T18:30:00Z')).has('2026-11')).toBe(true);
    expect(lastTwelveMonths(new Date('2026-10-31T17:30:00Z')).has('2026-11')).toBe(false);
  });
});

describe('gatherFarmRecordFacts', () => {
  it('returns zeros for a farmer with nothing', async () => {
    const { deps } = makeDeps({});
    expect(await gatherFarmRecordFacts(deps, 'u1', NOW)).toEqual({
      plots: 0,
      totalLandDecimals: 0,
      seasons: 0,
      seasonsWithCosts: 0,
      seasonsWithHarvest: 0,
      seasonsWithSales: 0,
      activeMonths: 0,
      cropChecks: 0,
    });
  });

  it('adds up land in decimals across units', async () => {
    const { deps } = makeDeps({
      plots: [
        doc('users/u1/plots/a', { name: 'A', landSize: 2, landUnit: 'bigha' }), // 66
        doc('users/u1/plots/b', { name: 'B', landSize: 1.5, landUnit: 'acre' }), // 150
        doc('users/u1/plots/c', { name: 'C', landSize: 10, landUnit: 'katha' }), // 16.5
      ],
    });
    const facts = await gatherFarmRecordFacts(deps, 'u1', NOW);
    expect(facts.plots).toBe(3);
    expect(facts.totalLandDecimals).toBe(232.5);
  });

  it('needs at least 3 costs for a season to count', async () => {
    const { deps } = makeDeps({
      seasons: [season('s1'), season('s2')],
      expenses: {
        s1: [expense('s1', 'e1', '2026-10-01'), expense('s1', 'e2', '2026-10-02'), expense('s1', 'e3', '2026-10-03')],
        s2: [expense('s2', 'e1', '2026-10-01'), expense('s2', 'e2', '2026-10-02')],
      },
    });
    const facts = await gatherFarmRecordFacts(deps, 'u1', NOW);
    expect(facts.seasons).toBe(2);
    expect(facts.seasonsWithCosts).toBe(1);
  });

  it('counts harvest only when harvestMon is above 0, and sales when there is at least one', async () => {
    const { deps } = makeDeps({
      seasons: [season('s1', { harvestMon: 30 }), season('s2', { harvestMon: 0 }), season('s3')],
      sales: { s1: [sale('s1', 'a', '2026-11-01')], s3: [sale('s3', 'a', '2026-11-02'), sale('s3', 'b', '2026-11-03')] },
    });
    const facts = await gatherFarmRecordFacts(deps, 'u1', NOW);
    expect(facts.seasonsWithHarvest).toBe(1);
    expect(facts.seasonsWithSales).toBe(2);
  });

  it('counts distinct months in the last 12 from costs, sales and crop checks', async () => {
    const { deps } = makeDeps({
      seasons: [season('s1')],
      expenses: {
        s1: [
          expense('s1', 'e1', '2026-11-05'),
          expense('s1', 'e2', '2026-11-20'), // same month as above
          expense('s1', 'e3', '2026-03-10'),
          expense('s1', 'e4', '2025-11-30'), // before the window
          expense('s1', 'e5', '2026-12-02'), // after the window (future)
        ],
      },
      sales: { s1: [sale('s1', 'a', '2026-03-25'), sale('s1', 'b', '2026-01-15')] },
      diagnoses: [stamp('2026-06-10T05:00:00Z'), stamp('2026-11-01T01:00:00Z')],
    });
    const facts = await gatherFarmRecordFacts(deps, 'u1', NOW);
    // 2026-11, 2026-03, 2026-01, 2026-06
    expect(facts.activeMonths).toBe(4);
  });

  it('counts only crop checks inside the 12-month window', async () => {
    const { deps } = makeDeps({
      diagnoses: [
        stamp('2026-11-27T10:00:00Z'),
        stamp('2026-01-01T10:00:00Z'),
        stamp('2025-12-15T10:00:00Z'), // first month of the window
        stamp('2025-11-15T10:00:00Z'), // too old
        stamp('2024-02-01T10:00:00Z'), // too old
      ],
    });
    const facts = await gatherFarmRecordFacts(deps, 'u1', NOW);
    expect(facts.cropChecks).toBe(3);
    expect(facts.activeMonths).toBe(3);
  });

  it('reads the diagnoses by userId, createdAt only, with a limit, and url-encodes the uid', async () => {
    const { deps, calls } = makeDeps({});
    await gatherFarmRecordFacts(deps, 'a/b c', NOW);
    const query = calls.find((c) => c.path === '/documents:runQuery')!;
    expect(query.body.structuredQuery.from).toEqual([{ collectionId: 'diagnoses' }]);
    expect(query.body.structuredQuery.where.fieldFilter).toMatchObject({
      field: { fieldPath: 'userId' },
      op: 'EQUAL',
      value: { stringValue: 'a/b c' },
    });
    expect(query.body.structuredQuery.select).toEqual({ fields: [{ fieldPath: 'createdAt' }] });
    expect(query.body.structuredQuery.limit).toBe(500);
    const plotsCall = calls.find((c) => c.path.includes('/plots'))!;
    expect(plotsCall.path).toBe('/documents/users/a%2Fb%20c/plots?pageSize=50');
    expect(calls.find((c) => c.path.includes('/seasons'))!.path).toBe('/documents/users/a%2Fb%20c/seasons?pageSize=50');
  });

  it('skips malformed documents instead of failing', async () => {
    const { deps } = makeDeps({
      plots: [
        doc('users/u1/plots/ok', { name: 'ok', landSize: 1, landUnit: 'acre' }),
        doc('users/u1/plots/neg', { name: 'x', landSize: -3, landUnit: 'acre' }),
        doc('users/u1/plots/unit', { name: 'x', landSize: 3, landUnit: 'hectare' }),
        doc('users/u1/plots/str', { name: 'x', landSize: 'big', landUnit: 'acre' }),
        { name: 'projects/p/databases/d/documents/users/u1/plots/nofields' },
        null,
      ],
      seasons: [season('s1', { harvestMon: 'lots' }), { name: 'projects/p/databases/d/documents/users/u1/seasons/empty' }],
      expenses: {
        s1: [
          expense('s1', 'e1', '2026-11-05'),
          expense('s1', 'e2', 'yesterday'), // counted as a cost, but no month
          expense('s1', 'e3', '2026-11-06', 'five hundred'), // not a cost
          expense('s1', 'e4', '2026-11-07', -20), // not a cost
        ],
      },
      diagnoses: [{ stringValue: 'not a time' }, stamp('garbage'), {}, stamp('2026-11-02T00:00:00Z')],
    });
    const facts = await gatherFarmRecordFacts(deps, 'u1', NOW);
    expect(facts.plots).toBe(1);
    expect(facts.totalLandDecimals).toBe(100);
    expect(facts.seasons).toBe(1);
    expect(facts.seasonsWithCosts).toBe(0); // only 2 valid costs
    expect(facts.seasonsWithHarvest).toBe(0);
    expect(facts.cropChecks).toBe(1);
    expect(facts.activeMonths).toBe(1);
  });

  it('throws an error that holds only a step name and a status code when Firestore refuses', async () => {
    const { deps } = makeDeps({ failOn: '/seasons?' });
    const error = await gatherFarmRecordFacts(deps, 'secret-uid', NOW).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('record_facts_seasons_503');
    expect(error.message).not.toContain('secret-uid');
  });

  it('reads many seasons in small batches', async () => {
    const seasons = Array.from({ length: 12 }, (_, i) => season(`s${i}`));
    const { deps, calls } = makeDeps({ seasons });
    const facts = await gatherFarmRecordFacts(deps, 'u1', NOW);
    expect(facts.seasons).toBe(12);
    expect(calls.filter((c) => c.path.includes('/expenses')).length).toBe(12);
    expect(calls.filter((c) => c.path.includes('/sales')).length).toBe(12);
  });
});
