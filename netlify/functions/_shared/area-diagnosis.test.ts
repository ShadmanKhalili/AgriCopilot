import { describe, expect, it } from 'vitest';
import { DIAGNOSIS_LIMIT, hasRecentDiagnosis } from './area-diagnosis.ts';

const NOW = new Date('2026-11-28T06:00:00Z');

const row = (createTime: string, fields: Record<string, string>) => ({
  document: {
    name: 'projects/p/databases/d/documents/diagnoses/x',
    createTime,
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: v }])),
  },
});

const fakeFetch = (rows: unknown[], status = 200) => {
  const calls: any[] = [];
  const adminFetch = async (path: string, init?: RequestInit) => {
    calls.push({ path, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(rows), { status });
  };
  return { adminFetch, calls };
};

const check = (rows: unknown[]) =>
  hasRecentDiagnosis({ adminFetch: fakeFetch(rows).adminFetch, now: () => NOW }, 'uid-1', 'potato:late-blight', 'pabna', 'ishurdi');

const here = { district: 'Pabna', upazila: 'Ishurdi' };

describe('hasRecentDiagnosis', () => {
  it('asks for this farmer, this disease, with a limit and no index-needing order', async () => {
    const fake = fakeFetch([{ readTime: 'x' }]);
    await hasRecentDiagnosis({ adminFetch: fake.adminFetch, now: () => NOW }, 'uid-1', 'potato:late-blight', 'pabna', 'ishurdi');
    const query = fake.calls[0].body.structuredQuery;
    expect(fake.calls[0].path).toBe('/documents:runQuery');
    expect(query.from).toEqual([{ collectionId: 'diagnoses' }]);
    expect(query.where.compositeFilter.filters.map((f: any) => [f.fieldFilter.field.fieldPath, f.fieldFilter.value.stringValue])).toEqual([
      ['userId', 'uid-1'],
      ['diseaseKey', 'potato:late-blight'],
    ]);
    expect(query.orderBy).toBeUndefined();
    expect(query.limit).toBe(DIAGNOSIS_LIMIT);
  });

  it('accepts a diagnosis from the last 14 days in the same place', async () => {
    expect(await check([row('2026-11-28T05:59:00Z', here)])).toBe(true);
    expect(await check([row('2026-11-15T00:00:00Z', { district: 'pabna', upazila: 'ISHURDI' })])).toBe(true);
  });

  it('refuses when there is no diagnosis at all', async () => {
    expect(await check([{ readTime: 'x' }])).toBe(false);
    expect(await check([])).toBe(false);
  });

  it('refuses a diagnosis older than 14 days, however the app dated it', async () => {
    expect(await check([row('2026-11-10T00:00:00Z', { ...here, createdAt: '2026-11-28T00:00:00Z' })])).toBe(false);
  });

  it('refuses a diagnosis from another place, or one with no place', async () => {
    expect(await check([row('2026-11-28T00:00:00Z', { district: 'Pabna', upazila: 'Santhia' })])).toBe(false);
    expect(await check([row('2026-11-28T00:00:00Z', { district: 'Dhaka', upazila: 'Ishurdi' })])).toBe(false);
    expect(await check([row('2026-11-28T00:00:00Z', { district: 'Pabna' })])).toBe(false);
  });

  it('finds the matching one among several, and skips a row with no creation time or one in the future', async () => {
    expect(
      await check([
        row('2026-12-30T00:00:00Z', here),
        { document: { fields: { district: { stringValue: 'Pabna' }, upazila: { stringValue: 'Ishurdi' } } } },
        row('2026-11-01T00:00:00Z', here),
        row('2026-11-27T00:00:00Z', here),
      ])
    ).toBe(true);
    expect(await check([row('2026-12-30T00:00:00Z', here)])).toBe(false);
  });

  it('throws, with only a status code, when Firestore cannot be read', async () => {
    await expect(
      hasRecentDiagnosis({ adminFetch: fakeFetch([], 500).adminFetch, now: () => NOW }, 'secret-uid', 'potato:late-blight', 'pabna', 'ishurdi')
    ).rejects.toThrow('area_diagnosis_query_500');
  });
});
