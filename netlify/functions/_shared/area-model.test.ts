import { describe, expect, it } from 'vitest';
import {
  AREA_MAX_REPORTERS_PER_GROUP,
  AREA_SUMMARY_VERSION,
  activeBroadcasts,
  activeWarnings,
  areaKey,
  buildPublished,
  cleanAreaReport,
  emptyRaw,
  farmersInGroup,
  localPrice,
  pruneRaw,
  withReport,
  type AreaPrice,
  type AreaRaw,
  type AreaSummary,
  type Broadcast,
} from './area-model.ts';

const TODAY = '2026-11-28';

const summary = (problems: any, prices: any = {}): AreaSummary => ({
  version: AREA_SUMMARY_VERSION,
  district: 'pabna',
  upazila: 'ishwardi',
  problems,
  prices,
  updatedAt: TODAY,
});

describe('cleanAreaReport', () => {
  it('tidies a problem report and builds its keys', () => {
    expect(
      cleanAreaReport({ kind: 'problem', district: ' Pabna ', upazila: 'Ishwardi', crop: 'Potato', diseaseKey: 'Potato:Late Blight' })
    ).toEqual({
      kind: 'problem',
      areaKey: 'pabna__ishwardi',
      district: 'Pabna',
      upazila: 'Ishwardi',
      crop: 'potato',
      diseaseKey: 'potato_late_blight',
      groupKey: 'pabna__ishwardi__problem__potato__potato_late_blight',
    });
  });

  it('accepts a believable price and rounds it', () => {
    const clean = cleanAreaReport({ kind: 'price', district: 'Pabna', upazila: 'Ishwardi', crop: 'rice', pricePerMon: 1234.6 });
    expect(clean).toMatchObject({ kind: 'price', pricePerMon: 1235, groupKey: 'pabna__ishwardi__price__rice' });
  });

  it('rejects missing parts, unknown kinds and unbelievable prices', () => {
    expect(cleanAreaReport(null)).toBeNull();
    expect(cleanAreaReport('x')).toBeNull();
    expect(cleanAreaReport({ kind: 'problem', district: 'Pabna', upazila: '', crop: 'rice', diseaseKey: 'blast' })).toBeNull();
    expect(cleanAreaReport({ kind: 'problem', district: 'Pabna', upazila: 'X', crop: 'rice', diseaseKey: '!!!' })).toBeNull();
    expect(cleanAreaReport({ kind: 'other', district: 'Pabna', upazila: 'X', crop: 'rice' })).toBeNull();
    expect(cleanAreaReport({ kind: 'price', district: 'Pabna', upazila: 'X', crop: 'rice', pricePerMon: 5 })).toBeNull();
    expect(cleanAreaReport({ kind: 'price', district: 'Pabna', upazila: 'X', crop: 'rice', pricePerMon: 1e9 })).toBeNull();
    expect(cleanAreaReport({ kind: 'price', district: 'Pabna', upazila: 'X', crop: 'rice', pricePerMon: 'abc' })).toBeNull();
  });

  it('makes the same key whatever the spelling of the area', () => {
    expect(areaKey('PABNA', 'Ishwardi ')).toBe(areaKey('pabna', 'ishwardi'));
  });
});

describe('activeWarnings', () => {
  const late = { crop: 'potato', diseaseKey: 'potato_late_blight' };
  const problem = (farmers: number, lastDay = TODAY, expiresDay = '2026-12-10') => ({ ...late, farmers, lastDay, expiresDay });

  it('needs at least 3 different farmers, even if the server sent fewer', () => {
    expect(activeWarnings(summary({ a: problem(2) }), TODAY)).toEqual([]);
    expect(activeWarnings(summary({ a: problem(3) }), TODAY)).toEqual([
      { crop: 'potato', diseaseKey: 'potato_late_blight', farmers: 3, lastDay: TODAY },
    ]);
  });

  it('counts only the last 14 days', () => {
    // 2026-11-15 is 13 days before the 28th: inside. 2026-11-14 is 14 days before: outside.
    expect(activeWarnings(summary({ a: problem(3, '2026-11-15', '2026-12-20') }), TODAY)).toHaveLength(1);
    expect(activeWarnings(summary({ a: problem(3, '2026-11-14', '2026-12-20') }), TODAY)).toEqual([]);
  });

  it('stops showing a problem on its expiry day, when it no longer has 3 farmers in the window', () => {
    expect(activeWarnings(summary({ a: problem(3, TODAY, '2026-11-29') }), TODAY)).toHaveLength(1);
    expect(activeWarnings(summary({ a: problem(3, TODAY, TODAY) }), TODAY)).toEqual([]);
    expect(activeWarnings(summary({ a: { ...problem(3), expiresDay: 'soon' } }), TODAY)).toEqual([]);
  });

  it('ignores future days, junk and a missing summary', () => {
    expect(activeWarnings(summary({ a: problem(3, '2026-12-30') }), TODAY)).toEqual([]);
    expect(activeWarnings(summary({ a: problem(Number.NaN) }), TODAY)).toEqual([]);
    expect(activeWarnings(summary({ a: problem(3.5) }), TODAY)).toEqual([]);
    expect(activeWarnings(null, TODAY)).toEqual([]);
    expect(activeWarnings(undefined, TODAY)).toEqual([]);
  });

  it('ignores a summary in the old shape (per-farmer days, no version)', () => {
    const old: any = {
      district: 'Pabna',
      upazila: 'Ishwardi',
      problems: { a: { ...late, reporterDays: [TODAY, TODAY, TODAY] } },
      prices: {},
      updatedAt: '2026-11-28T00:00:00.000Z',
    };
    expect(activeWarnings(old, TODAY)).toEqual([]);
    expect(activeWarnings({ ...old, version: 2 }, TODAY)).toEqual([]);
  });

  it('lists the problem with the most farmers first', () => {
    const list = activeWarnings(
      summary({
        a: { crop: 'rice', diseaseKey: 'blast', farmers: 3, lastDay: TODAY, expiresDay: '2026-12-10' },
        b: problem(4),
      }),
      TODAY
    );
    expect(list.map((w) => w.diseaseKey)).toEqual(['potato_late_blight', 'blast']);
  });
});

describe('localPrice', () => {
  const price = (over: Partial<AreaPrice> = {}): AreaPrice => ({
    crop: 'rice',
    farmers: 3,
    avgPerMon: 1130,
    lowPerMon: 1000,
    highPerMon: 1300,
    lastDay: TODAY,
    expiresDay: '2026-12-10',
    ...over,
  });

  it('gives the published average, low, high and count', () => {
    expect(localPrice(summary({}, { rice: price() }), 'Rice', TODAY)).toEqual({
      crop: 'rice',
      avgPerMon: 1130,
      lowPerMon: 1000,
      highPerMon: 1300,
      farmers: 3,
      lastDay: TODAY,
    });
  });

  it('needs 3 farmers and a current group', () => {
    expect(localPrice(summary({}, { rice: price({ farmers: 2 }) }), 'rice', TODAY)).toBeNull();
    expect(localPrice(summary({}, { rice: price({ lastDay: '2026-11-01' }) }), 'rice', TODAY)).toBeNull();
    expect(localPrice(summary({}, { rice: price({ expiresDay: TODAY }) }), 'rice', TODAY)).toBeNull();
  });

  it('ignores unbelievable numbers, unknown crops, old summaries and nothing at all', () => {
    expect(localPrice(summary({}, { rice: price({ lowPerMon: 0 }) }), 'rice', TODAY)).toBeNull();
    expect(localPrice(summary({}, { rice: price({ lowPerMon: 1200 }) }), 'rice', TODAY)).toBeNull();
    expect(localPrice(summary({}, {}), 'wheat', TODAY)).toBeNull();
    expect(localPrice(summary({}, {}), 'constructor', TODAY)).toBeNull();
    expect(localPrice({ ...summary({}, { rice: price() }), version: 1 }, 'rice', TODAY)).toBeNull();
    expect(localPrice(null, 'rice', TODAY)).toBeNull();
  });
});

describe('raw reports and the published summary', () => {
  const report = (kind: 'problem' | 'price', extra: Record<string, unknown> = {}) =>
    cleanAreaReport({
      kind,
      district: 'Pabna',
      upazila: 'Ishwardi',
      crop: kind === 'problem' ? 'potato' : 'rice',
      ...(kind === 'problem' ? { diseaseKey: 'potato:late-blight' } : { pricePerMon: 1000 }),
      ...extra,
    })!;

  /** Adds one report per farmer, each on the given day. */
  const build = (rep: ReturnType<typeof report>, days: Record<string, string>): AreaRaw =>
    Object.entries(days).reduce((raw, [who, day]) => withReport(raw, rep, who, day), emptyRaw());

  it('publishes only the aggregate of a problem with 3 farmers, and no per-farmer data', () => {
    const raw = build(report('problem'), { aa: '2026-11-20', bb: '2026-11-24', cc: '2026-11-27' });
    const published = buildPublished(raw, TODAY);
    expect(published.problems).toEqual({
      potato__potato_late_blight: {
        crop: 'potato',
        diseaseKey: 'potato_late_blight',
        farmers: 3,
        lastDay: '2026-11-27',
        expiresDay: '2026-12-04',
      },
    });
    const text = JSON.stringify(published);
    for (const leak of ['"aa"', '"bb"', '"cc"', 'reporters', 'reporterDays', '2026-11-24']) expect(text).not.toContain(leak);
  });

  it('publishes nothing for 1 or 2 farmers', () => {
    expect(buildPublished(build(report('problem'), { a: TODAY, b: TODAY }), TODAY)).toEqual({ problems: {}, prices: {} });
    expect(buildPublished(build(report('price'), { a: TODAY, b: TODAY }), TODAY)).toEqual({ problems: {}, prices: {} });
  });

  it('counts a farmer once, however often they report', () => {
    const rep = report('problem');
    let raw = build(rep, { a: '2026-11-20', b: '2026-11-21' });
    raw = withReport(raw, rep, 'a', TODAY);
    raw = withReport(raw, rep, 'a', TODAY);
    expect(farmersInGroup(raw, rep, TODAY)).toBe(2);
    expect(buildPublished(raw, TODAY).problems).toEqual({});
  });

  it('drops a group that has fallen out of the window or below 3 farmers', () => {
    const rep = report('problem');
    const raw = build(rep, { a: '2026-11-16', b: '2026-11-25', c: '2026-11-27' });
    expect(Object.keys(buildPublished(raw, TODAY).problems)).toHaveLength(1);
    // Two days later the 16th is outside the window: 2 farmers are left.
    expect(buildPublished(raw, '2026-11-30').problems).toEqual({});
    // And the whole group is gone once pruned.
    expect(pruneRaw(raw, '2026-12-20')).toEqual(emptyRaw());
  });

  it('expires a group on the day its 3rd newest report leaves the window', () => {
    const raw = build(report('problem'), { a: '2026-11-16', b: '2026-11-25', c: '2026-11-27', d: '2026-11-27' });
    // The 3 newest are 11-27, 11-27, 11-25: the group stops counting 14 days after 11-25.
    expect(buildPublished(raw, TODAY).problems.potato__potato_late_blight).toMatchObject({
      farmers: 4,
      lastDay: '2026-11-27',
      expiresDay: '2026-12-09',
    });
  });

  it('publishes a rounded average and a widened range, never single prices', () => {
    let raw = emptyRaw();
    raw = withReport(raw, report('price', { pricePerMon: 1013 }), 'a', TODAY);
    raw = withReport(raw, report('price', { pricePerMon: 1126 }), 'b', '2026-11-27');
    raw = withReport(raw, report('price', { pricePerMon: 1290 }), 'c', '2026-11-26');
    const { prices } = buildPublished(raw, TODAY);
    expect(prices.rice).toEqual({
      crop: 'rice',
      farmers: 3,
      avgPerMon: 1140, // (1013 + 1126 + 1290) / 3 = 1143, to the nearest 10
      lowPerMon: 1000, // 1013 rounded down to 50
      highPerMon: 1300, // 1290 rounded up to 50
      lastDay: TODAY,
      expiresDay: '2026-12-10',
    });
    const text = JSON.stringify(prices);
    for (const exact of ['1013', '1126', '1290']) expect(text).not.toContain(exact);
  });

  it('keeps the average inside the published range and the believable bounds', () => {
    const raw = ['a', 'b', 'c'].reduce((r, who) => withReport(r, report('price', { pricePerMon: 100 }), who, TODAY), emptyRaw());
    expect(buildPublished(raw, TODAY).prices.rice).toMatchObject({ avgPerMon: 100, lowPerMon: 100, highPerMon: 100 });
  });

  it('ignores unbelievable stored prices and old days when counting farmers', () => {
    const rep = report('price');
    const raw: AreaRaw = {
      problems: {},
      prices: {
        rice: {
          crop: 'rice',
          reporters: {
            a: { day: TODAY, pricePerMon: 5 },
            b: { day: TODAY, pricePerMon: 900 },
            c: { day: '2026-10-01', pricePerMon: 900 },
          },
        },
      },
    };
    expect(farmersInGroup(raw, rep, TODAY)).toBe(1);
    expect(pruneRaw(raw, TODAY).prices.rice.reporters).toEqual({ b: { day: TODAY, pricePerMon: 900 } });
  });

  it('keeps only the newest reporters of a very large group', () => {
    const reporters = Object.fromEntries(
      Array.from({ length: AREA_MAX_REPORTERS_PER_GROUP + 20 }, (_, i) => [`w${i}`, { day: i < 20 ? '2026-11-16' : TODAY }])
    );
    const raw: AreaRaw = {
      problems: { potato__potato_late_blight: { crop: 'potato', diseaseKey: 'potato_late_blight', reporters } },
      prices: {},
    };
    const pruned = pruneRaw(raw, TODAY).problems.potato__potato_late_blight.reporters;
    expect(Object.keys(pruned)).toHaveLength(AREA_MAX_REPORTERS_PER_GROUP);
    expect(Object.values(pruned).every((entry) => entry.day === TODAY)).toBe(true);
  });
});

describe('activeBroadcasts', () => {
  const item = (over: Partial<Broadcast>): Broadcast => ({
    messageBn: 'বার্তা',
    messageEn: 'message',
    district: 'all',
    severity: 'info',
    createdAt: '2026-11-27T00:00:00.000Z',
    expiresDay: '2026-12-05',
    createdBy: 'admin',
    ...over,
  });

  it('shows all-district messages and messages for the farmer\'s district', () => {
    const list = [item({}), item({ district: 'Pabna' }), item({ district: 'Dhaka' })];
    expect(activeBroadcasts(list, 'pabna', TODAY)).toHaveLength(2);
    expect(activeBroadcasts(list, '', TODAY)).toHaveLength(1);
  });

  it('hides expired messages and keeps one that expires today', () => {
    const list = [item({ expiresDay: '2026-11-27' }), item({ expiresDay: TODAY })];
    expect(activeBroadcasts(list, 'pabna', TODAY)).toHaveLength(1);
  });

  it('puts the newest first', () => {
    const older = item({ createdAt: '2026-11-20T00:00:00.000Z', messageEn: 'older' });
    const newer = item({ createdAt: '2026-11-27T00:00:00.000Z', messageEn: 'newer' });
    expect(activeBroadcasts([older, newer], 'pabna', TODAY).map((b) => b.messageEn)).toEqual(['newer', 'older']);
  });
});
