import { describe, expect, it } from 'vitest';
import { cleanAreaReport } from './area-model.ts';
import { MAX_ATTEMPTS, MAX_REPORTS_PER_DAY, parseRaw, recordAreaReport, type AreaStoreDeps } from './area-store.ts';
import { fromFirestoreDocument } from './service-account.ts';

const ROOT = 'projects/p/databases/d/documents/';

/**
 * A tiny fake Firestore: documents with an update time, plain GET, and
 * `documents:commit` with the "must not exist" and "update time equals"
 * preconditions the store relies on. `beforeCommit` lets a test change the
 * database between the store's read and its commit, as a second request would.
 */
const makeFake = () => {
  const docs = new Map<string, { fields: any; updateTime: string }>();
  const calls: Array<{ path: string; method: string; body: any }> = [];
  let clock = 0;
  let beforeCommit: ((commitNo: number) => void) | null = null;
  let commits = 0;

  const stamp = () => `2026-11-28T00:00:${String(++clock).padStart(2, '0')}.000000Z`;
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  const set = (key: string, fields: any) => docs.set(key, { fields, updateTime: stamp() });

  const adminFetch: AreaStoreDeps['adminFetch'] = async (path, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ path, method, body });

    if (path === '/documents:commit') {
      commits += 1;
      beforeCommit?.(commits);
      // Check every precondition first: a commit is all or nothing.
      for (const write of body.writes) {
        const key = write.update.name.replace(ROOT, '');
        const existing = docs.get(key);
        const pre = write.currentDocument;
        if (pre?.exists === false && existing) return json({ error: { status: 'ALREADY_EXISTS' } }, 409);
        if (pre?.updateTime && existing?.updateTime !== pre.updateTime) {
          return json({ error: { status: 'FAILED_PRECONDITION' } }, 400);
        }
      }
      for (const write of body.writes) set(write.update.name.replace(ROOT, ''), write.update.fields);
      return json({ writeResults: [] });
    }
    const key = decodeURIComponent(path.replace('/documents/', ''));
    if (method === 'GET') {
      const found = docs.get(key);
      return found ? json({ name: `${ROOT}${key}`, fields: found.fields, updateTime: found.updateTime }) : json({ error: 'nf' }, 404);
    }
    return json({}, 500);
  };
  return {
    docs,
    calls,
    adminFetch,
    commits: () => commits,
    onCommit: (fn: (commitNo: number) => void) => {
      beforeCommit = fn;
    },
    plain: (key: string) => fromFirestoreDocument({ fields: docs.get(key)?.fields }) as any,
  };
};

const deps = (fake: ReturnType<typeof makeFake>, today = '2026-11-28'): AreaStoreDeps => ({
  adminFetch: fake.adminFetch,
  anonymousId: (uid) => `anon_${uid}`,
  documentName: (path) => `${ROOT}${path}`,
  today,
});

const problem = cleanAreaReport({
  kind: 'problem',
  district: 'Pabna',
  upazila: 'Ishwardi',
  crop: 'Potato',
  diseaseKey: 'potato:late-blight',
})!;
const price = (pricePerMon: number) =>
  cleanAreaReport({ kind: 'price', district: 'Pabna', upazila: 'Ishwardi', crop: 'Potato', pricePerMon })!;

describe('recordAreaReport', () => {
  it('keeps the farmer in the private raw document under a hashed code, never as a uid', async () => {
    const fake = makeFake();
    const result = await recordAreaReport(deps(fake), problem, 'uid-1');
    expect(result.status).toBe('stored');
    const raw = fake.plain('area_raw/pabna__ishwardi');
    expect(raw.problems.potato__potato_late_blight.reporters).toEqual({ 'anon_uid-1': { day: '2026-11-28' } });
    expect(JSON.stringify(fake.calls)).not.toContain('"uid-1"');
    // Not one of the older per-farmer documents.
    expect([...fake.docs.keys()].some((key) => key.startsWith('area_reporters/pabna'))).toBe(false);
  });

  it('publishes nothing about a problem until 3 different farmers reported it', async () => {
    const fake = makeFake();
    await recordAreaReport(deps(fake), problem, 'a');
    await recordAreaReport(deps(fake), problem, 'b');
    const early = fake.plain('area_summaries/pabna__ishwardi');
    expect(early).toEqual({
      version: 2,
      district: 'Pabna',
      upazila: 'Ishwardi',
      problems: {},
      prices: {},
      updatedAt: '2026-11-28',
    });

    await recordAreaReport(deps(fake), problem, 'c');
    const published = fake.plain('area_summaries/pabna__ishwardi');
    expect(published.problems).toEqual({
      potato__potato_late_blight: {
        crop: 'potato',
        diseaseKey: 'potato_late_blight',
        farmers: 3,
        lastDay: '2026-11-28',
        expiresDay: '2026-12-12',
      },
    });
  });

  it('writes an aggregate summary with a Dhaka date and nothing that identifies a farmer', async () => {
    const fake = makeFake();
    for (const uid of ['a', 'b', 'c']) await recordAreaReport(deps(fake), problem, uid);
    for (const [uid, value] of [['a', 1013], ['b', 1126], ['c', 1290]] as const) await recordAreaReport(deps(fake), price(value), uid);
    const text = JSON.stringify(fake.docs.get('area_summaries/pabna__ishwardi')!.fields);
    expect(text).not.toMatch(/anon_|reporter|1013|1126|1290/);
    expect(fake.plain('area_summaries/pabna__ishwardi').updatedAt).toBe('2026-11-28');
    expect(fake.plain('area_summaries/pabna__ishwardi').prices.potato).toMatchObject({
      farmers: 3,
      avgPerMon: 1140,
      lowPerMon: 1000,
      highPerMon: 1300,
    });
  });

  it('writes the quota, the raw document and the summary in one commit', async () => {
    const fake = makeFake();
    await recordAreaReport(deps(fake), problem, 'a');
    const commits = fake.calls.filter((c) => c.path === '/documents:commit');
    expect(commits).toHaveLength(1);
    expect(commits[0].body.writes.map((w: any) => w.update.name.replace(ROOT, ''))).toEqual([
      'area_reporters/quota__anon_a',
      'area_raw/pabna__ishwardi',
      'area_summaries/pabna__ishwardi',
    ]);
    // First write of each: "must not exist". The summary is replaced whole.
    expect(commits[0].body.writes[0].currentDocument).toEqual({ exists: false });
    expect(commits[0].body.writes[1].currentDocument).toEqual({ exists: false });
    expect(commits[0].body.writes[2].currentDocument).toBeUndefined();
  });

  it('flags the report that takes a problem from 2 to 3 farmers, and only that one', async () => {
    const fake = makeFake();
    const results = [];
    for (const uid of ['a', 'b', 'c', 'd']) results.push(await recordAreaReport(deps(fake), problem, uid));
    expect(results.map((r) => (r.status === 'stored' ? r.crossedThreshold : null))).toEqual([false, false, true, false]);
    expect(results[2]).toMatchObject({ farmers: 3 });
  });

  it('does not count reports older than 14 days, and drops them from the published summary', async () => {
    const fake = makeFake();
    for (const uid of ['a', 'b', 'c']) await recordAreaReport(deps(fake, '2026-11-01'), problem, uid);
    expect(Object.keys(fake.plain('area_summaries/pabna__ishwardi').problems)).toHaveLength(1);
    const result = await recordAreaReport(deps(fake, '2026-11-28'), problem, 'd');
    expect(result).toMatchObject({ status: 'stored', farmers: 1, crossedThreshold: false });
    expect(fake.plain('area_summaries/pabna__ishwardi').problems).toEqual({});
    expect(Object.keys(fake.plain('area_raw/pabna__ishwardi').problems.potato__potato_late_blight.reporters)).toEqual(['anon_d']);
  });

  it('drops a group from the summary when a later report in the same area shrinks it', async () => {
    const fake = makeFake();
    for (const uid of ['a', 'b']) await recordAreaReport(deps(fake, '2026-11-14'), problem, uid);
    await recordAreaReport(deps(fake, '2026-11-20'), problem, 'c');
    expect(Object.keys(fake.plain('area_summaries/pabna__ishwardi').problems)).toHaveLength(1);
    // On the 28th, the two reports from the 14th have left the window.
    await recordAreaReport(deps(fake, '2026-11-28'), price(900), 'e');
    expect(fake.plain('area_summaries/pabna__ishwardi').problems).toEqual({});
  });

  it('does not rewrite when the same farmer reports the same group again today', async () => {
    const fake = makeFake();
    await recordAreaReport(deps(fake), problem, 'a');
    const commits = fake.commits();
    const again = await recordAreaReport(deps(fake), problem, 'a');
    expect(again.status).toBe('repeat');
    expect(fake.commits()).toBe(commits);
  });

  it('stops a farmer after the daily maximum', async () => {
    const fake = makeFake();
    fake.docs.set('area_reporters/quota__anon_a', {
      fields: { day: { stringValue: '2026-11-28' }, count: { integerValue: String(MAX_REPORTS_PER_DAY) } },
      updateTime: 't0',
    });
    const result = await recordAreaReport(deps(fake), problem, 'a');
    expect(result.status).toBe('limited');
    expect(fake.commits()).toBe(0);
  });

  it('starts the count again on a new day', async () => {
    const fake = makeFake();
    fake.docs.set('area_reporters/quota__anon_a', {
      fields: { day: { stringValue: '2026-11-27' }, count: { integerValue: String(MAX_REPORTS_PER_DAY) } },
      updateTime: 't0',
    });
    expect((await recordAreaReport(deps(fake), problem, 'a')).status).toBe('stored');
    expect(fake.plain('area_reporters/quota__anon_a')).toEqual({ day: '2026-11-28', count: 1 });
  });

  describe('when two reports race', () => {
    it('refuses the commit whose quota changed underneath it and starts over, so the limit holds', async () => {
      const fake = makeFake();
      fake.docs.set('area_reporters/quota__anon_a', {
        fields: { day: { stringValue: '2026-11-28' }, count: { integerValue: String(MAX_REPORTS_PER_DAY - 1) } },
        updateTime: 't0',
      });
      // Another request of the same farmer uses the last report while this one is deciding.
      fake.onCommit((n) => {
        if (n === 1) {
          fake.docs.set('area_reporters/quota__anon_a', {
            fields: { day: { stringValue: '2026-11-28' }, count: { integerValue: String(MAX_REPORTS_PER_DAY) } },
            updateTime: 't1',
          });
        }
      });
      const result = await recordAreaReport(deps(fake), problem, 'a');
      expect(result.status).toBe('limited');
      expect(fake.plain('area_reporters/quota__anon_a').count).toBe(MAX_REPORTS_PER_DAY);
      expect(fake.docs.has('area_raw/pabna__ishwardi')).toBe(false);
    });

    it('keeps both reports when another farmer reports between the read and the commit', async () => {
      const fake = makeFake();
      await recordAreaReport(deps(fake), problem, 'a');
      fake.onCommit((n) => {
        if (n === 2) {
          // While "b" decides, "c" gets in first.
          const raw = fake.docs.get('area_raw/pabna__ishwardi')!;
          const fields = JSON.parse(JSON.stringify(raw.fields));
          fields.problems.mapValue.fields.potato__potato_late_blight.mapValue.fields.reporters.mapValue.fields.anon_c = {
            mapValue: { fields: { day: { stringValue: '2026-11-28' } } },
          };
          fake.docs.set('area_raw/pabna__ishwardi', { fields, updateTime: 'newer' });
        }
      });
      const result = await recordAreaReport(deps(fake), problem, 'b');
      expect(result).toMatchObject({ status: 'stored', farmers: 3, crossedThreshold: true });
      const reporters = fake.plain('area_raw/pabna__ishwardi').problems.potato__potato_late_blight.reporters;
      expect(Object.keys(reporters).sort()).toEqual(['anon_a', 'anon_b', 'anon_c']);
    });

    it('gives up with an error after too many conflicts', async () => {
      const fake = makeFake();
      fake.onCommit(() => {
        fake.docs.set('area_raw/pabna__ishwardi', { fields: {}, updateTime: `x${Math.random()}` });
      });
      await expect(recordAreaReport(deps(fake), problem, 'a')).rejects.toThrow('area_store_conflict');
      expect(fake.commits()).toBe(MAX_ATTEMPTS);
    });
  });

  it('throws when Firestore refuses the commit, without the uid in the message', async () => {
    const fake = makeFake();
    const failing: AreaStoreDeps = {
      ...deps(fake),
      adminFetch: async (path, init) =>
        path === '/documents:commit' ? new Response('{}', { status: 403 }) : fake.adminFetch(path, init),
    };
    await expect(recordAreaReport(failing, problem, 'secret-uid')).rejects.toThrow('area_store_commit_403');
  });

  it('throws when a document cannot be read', async () => {
    const fake = makeFake();
    const failing: AreaStoreDeps = { ...deps(fake), adminFetch: async () => new Response('{}', { status: 500 }) };
    await expect(recordAreaReport(failing, problem, 'a')).rejects.toThrow('area_store_read_500');
  });

  it('replaces a summary in the old shape whole, so its per-farmer data is gone', async () => {
    const fake = makeFake();
    fake.docs.set('area_summaries/pabna__ishwardi', {
      fields: {
        district: { stringValue: 'Pabna' },
        problems: { mapValue: { fields: { old: { mapValue: { fields: { reporterDays: { arrayValue: { values: [{ stringValue: '2026-11-27' }] } } } } } } } },
        updatedAt: { stringValue: '2026-11-27T01:02:03.000Z' },
      },
      updateTime: 'old',
    });
    await recordAreaReport(deps(fake), problem, 'a');
    const text = JSON.stringify(fake.docs.get('area_summaries/pabna__ishwardi')!.fields);
    expect(text).not.toContain('reporterDays');
    expect(fake.plain('area_summaries/pabna__ishwardi').version).toBe(2);
  });
});

describe('parseRaw', () => {
  it('returns an empty document for nothing, and ignores entries that are not shaped as expected', () => {
    expect(parseRaw(null)).toEqual({ problems: {}, prices: {} });
    expect(
      parseRaw({
        problems: { x: { crop: 'potato', diseaseKey: 'k', reporters: { a: { day: '2026-11-28' }, b: 'nope', c: { day: 5 } } } },
        prices: 'junk',
      })
    ).toEqual({ problems: { x: { crop: 'potato', diseaseKey: 'k', reporters: { a: { day: '2026-11-28' } } } }, prices: {} });
  });
});
