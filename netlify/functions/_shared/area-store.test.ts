import { describe, expect, it } from 'vitest';
import { cleanAreaReport } from './area-model.ts';
import { MAX_REPORTS_PER_DAY, MAX_SUMMARY_KEYS, fieldPath, recordAreaReport, type AreaStoreDeps } from './area-store.ts';

/** A tiny fake Firestore that understands the four calls the store makes. */
const makeFake = () => {
  const docs = new Map<string, any>(); // key: "collection/id" -> Firestore fields
  const calls: Array<{ path: string; method: string; body: any }> = [];

  const adminFetch: AreaStoreDeps['adminFetch'] = async (path, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ path, method, body });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

    if (path === '/documents:runQuery') {
      const wanted = body.structuredQuery.where.fieldFilter.value.stringValue;
      const rows = [...docs.entries()]
        .filter(([key, fields]) => key.startsWith('area_reporters/') && fields.groupKey?.stringValue === wanted)
        .map(([key, fields]) => ({ document: { name: `projects/p/databases/d/documents/${key}`, fields } }));
      return json(rows.length ? rows : [{ readTime: 'x' }]);
    }
    const [pathOnly] = path.split('?');
    const key = decodeURIComponent(pathOnly.replace('/documents/', ''));
    if (method === 'GET') return docs.has(key) ? json({ fields: docs.get(key) }) : json({ error: 'nf' }, 404);
    if (method === 'PATCH') {
      const mask = new URL(`http://x${path}`).searchParams.getAll('updateMask.fieldPaths');
      if (mask.length === 0) docs.set(key, body.fields);
      else docs.set(key, { ...(docs.get(key) || {}), ...body.fields }); // enough for these tests
      return json({});
    }
    return json({}, 500);
  };
  return { docs, calls, adminFetch };
};

const deps = (fake: ReturnType<typeof makeFake>, today = '2026-11-28'): AreaStoreDeps => ({
  adminFetch: fake.adminFetch,
  anonymousId: (uid) => `anon_${uid}`,
  today,
  now: () => new Date('2026-11-28T06:00:00Z'),
});

const problem = cleanAreaReport({
  kind: 'problem',
  district: 'Pabna',
  upazila: 'Ishwardi',
  crop: 'Potato',
  diseaseKey: 'late_blight',
})!;
const price = cleanAreaReport({ kind: 'price', district: 'Pabna', upazila: 'Ishwardi', crop: 'Potato', pricePerMon: 900 })!;

describe('fieldPath', () => {
  it('leaves plain identifiers alone and backtick-quotes the rest', () => {
    expect(fieldPath('problems', 'potato__late_blight')).toBe('problems.potato__late_blight');
    expect(fieldPath('prices', '2_4_d')).toBe('prices.`2_4_d`');
  });
});

describe('recordAreaReport', () => {
  it('writes the reporter under a hashed id and never the uid', async () => {
    const fake = makeFake();
    const result = await recordAreaReport(deps(fake), problem, 'uid-1');
    expect(result.status).toBe('stored');
    const key = `area_reporters/${problem.groupKey}__anon_uid-1`;
    expect(fake.docs.get(key)).toMatchObject({
      groupKey: { stringValue: problem.groupKey },
      day: { stringValue: '2026-11-28' },
    });
    expect(JSON.stringify(fake.calls)).not.toContain('"uid-1"');
  });

  it('patches only the one problem path plus district, upazila and updatedAt', async () => {
    const fake = makeFake();
    await recordAreaReport(deps(fake), problem, 'uid-1');
    const patch = fake.calls.find((c) => c.method === 'PATCH' && c.path.startsWith('/documents/area_summaries/'))!;
    const url = new URL(`http://x${patch.path}`);
    expect(decodeURIComponent(url.pathname)).toBe('/documents/area_summaries/pabna__ishwardi');
    expect(url.searchParams.getAll('updateMask.fieldPaths')).toEqual([
      'problems.potato__late_blight',
      'district',
      'upazila',
      'updatedAt',
    ]);
    expect(patch.body.fields.updatedAt).toEqual({ stringValue: '2026-11-28T06:00:00.000Z' });
    expect(Object.keys(patch.body.fields.problems.mapValue.fields)).toEqual(['potato__late_blight']);
  });

  it('patches prices.<crop> for a price report with the rounded price', async () => {
    const fake = makeFake();
    await recordAreaReport(deps(fake), price, 'uid-1');
    const patch = fake.calls.find((c) => c.method === 'PATCH' && c.path.startsWith('/documents/area_summaries/'))!;
    expect(new URL(`http://x${patch.path}`).searchParams.getAll('updateMask.fieldPaths')[0]).toBe('prices.potato');
    const entry = patch.body.fields.prices.mapValue.fields.potato.arrayValue.values[0].mapValue.fields;
    expect(entry.pricePerMon).toEqual({ integerValue: '900' });
    expect(entry.day).toEqual({ stringValue: '2026-11-28' });
  });

  it('flags the report that takes a problem from 2 to 3 farmers, and only that one', async () => {
    const fake = makeFake();
    const results = [];
    for (const uid of ['a', 'b', 'c', 'd']) results.push(await recordAreaReport(deps(fake), problem, uid));
    expect(results.map((r) => (r.status === 'stored' ? r.crossedThreshold : null))).toEqual([false, false, true, false]);
    expect(results[2]).toMatchObject({ farmers: 3 });
  });

  it('does not count reports older than 14 days toward the threshold', async () => {
    const fake = makeFake();
    await recordAreaReport(deps(fake, '2026-11-01'), problem, 'a');
    await recordAreaReport(deps(fake, '2026-11-01'), problem, 'b');
    const result = await recordAreaReport(deps(fake, '2026-11-28'), problem, 'c');
    expect(result).toMatchObject({ status: 'stored', farmers: 1, crossedThreshold: false });
  });

  it('does not rewrite when the same farmer reports the same group again today', async () => {
    const fake = makeFake();
    await recordAreaReport(deps(fake), problem, 'a');
    const writes = fake.calls.filter((c) => c.method === 'PATCH').length;
    const again = await recordAreaReport(deps(fake), problem, 'a');
    expect(again.status).toBe('repeat');
    expect(fake.calls.filter((c) => c.method === 'PATCH').length).toBe(writes);
  });

  it('stops a farmer after the daily maximum', async () => {
    const fake = makeFake();
    fake.docs.set('area_reporters/quota__anon_a', {
      day: { stringValue: '2026-11-28' },
      count: { integerValue: String(MAX_REPORTS_PER_DAY) },
    });
    const result = await recordAreaReport(deps(fake), problem, 'a');
    expect(result.status).toBe('limited');
    expect(fake.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('throws when Firestore refuses the summary write, without the uid in the message', async () => {
    const fake = makeFake();
    const failing: AreaStoreDeps = {
      ...deps(fake),
      adminFetch: async (path, init) =>
        init?.method === 'PATCH' && path.startsWith('/documents/area_summaries/')
          ? new Response('{}', { status: 403 })
          : fake.adminFetch(path, init),
    };
    await expect(recordAreaReport(failing, problem, 'secret-uid')).rejects.toThrow('area_store_summary_403');
  });

  it('does not add a new problem once an area summary is full, but still updates known ones', async () => {
    const fake = makeFake();
    const full: Record<string, any> = {};
    for (let i = 0; i < MAX_SUMMARY_KEYS; i++) full[`crop${i}__x`] = { mapValue: { fields: {} } };
    fake.docs.set('area_summaries/pabna__ishwardi', { problems: { mapValue: { fields: full } } });
    const result = await recordAreaReport(deps(fake), problem, 'a');
    expect(result).toMatchObject({ status: 'stored', crossedThreshold: false });
    expect(fake.calls.some((c) => c.method === 'PATCH' && c.path.startsWith('/documents/area_summaries/'))).toBe(false);
  });
});
