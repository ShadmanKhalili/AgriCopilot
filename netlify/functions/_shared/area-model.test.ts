import { describe, expect, it } from 'vitest';
import {
  activeBroadcasts,
  activeWarnings,
  areaKey,
  cleanAreaReport,
  localPrice,
  type AreaSummary,
  type Broadcast,
} from './area-model.ts';

const TODAY = '2026-11-28';

const summary = (problems: AreaSummary['problems'], prices: AreaSummary['prices'] = {}): AreaSummary => ({
  district: 'Pabna',
  upazila: 'Ishwardi',
  problems,
  prices,
  updatedAt: '2026-11-28T00:00:00.000Z',
});

describe('cleanAreaReport', () => {
  it('tidies a problem report and builds its keys', () => {
    expect(
      cleanAreaReport({ kind: 'problem', district: ' Pabna ', upazila: 'Ishwardi', crop: 'Potato', diseaseKey: 'Late Blight' })
    ).toEqual({
      kind: 'problem',
      areaKey: 'pabna__ishwardi',
      district: 'Pabna',
      upazila: 'Ishwardi',
      crop: 'potato',
      diseaseKey: 'late_blight',
      groupKey: 'pabna__ishwardi__problem__potato__late_blight',
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
  const late = { crop: 'potato', diseaseKey: 'late_blight' };

  it('needs at least 3 different farmers', () => {
    expect(activeWarnings(summary({ a: { ...late, reporterDays: [TODAY, TODAY] } }), TODAY)).toEqual([]);
    const three = activeWarnings(summary({ a: { ...late, reporterDays: [TODAY, '2026-11-27', '2026-11-20'] } }), TODAY);
    expect(three).toEqual([{ crop: 'potato', diseaseKey: 'late_blight', farmers: 3, lastDay: TODAY }]);
  });

  it('counts only the last 14 days', () => {
    // 2026-11-15 is 13 days before the 28th: inside. 2026-11-14 is 14 days before: outside.
    const inside = summary({ a: { ...late, reporterDays: ['2026-11-15', '2026-11-16', '2026-11-17'] } });
    expect(activeWarnings(inside, TODAY)).toHaveLength(1);
    const outside = summary({ a: { ...late, reporterDays: ['2026-11-14', '2026-11-16', '2026-11-17'] } });
    expect(activeWarnings(outside, TODAY)).toEqual([]);
  });

  it('ignores future days, junk and a missing summary', () => {
    expect(activeWarnings(summary({ a: { ...late, reporterDays: ['2026-12-30', 'x', TODAY] } }), TODAY)).toEqual([]);
    expect(activeWarnings(null, TODAY)).toEqual([]);
    expect(activeWarnings(undefined, TODAY)).toEqual([]);
  });

  it('lists the problem with the most farmers first', () => {
    const list = activeWarnings(
      summary({
        a: { crop: 'rice', diseaseKey: 'blast', reporterDays: [TODAY, TODAY, TODAY] },
        b: { crop: 'potato', diseaseKey: 'late_blight', reporterDays: [TODAY, TODAY, TODAY, TODAY] },
      }),
      TODAY
    );
    expect(list.map((w) => w.diseaseKey)).toEqual(['late_blight', 'blast']);
  });
});

describe('localPrice', () => {
  const entry = (pricePerMon: number, day = TODAY) => ({ day, pricePerMon });

  it('needs 3 recent prices', () => {
    expect(localPrice(summary({}, { rice: [entry(1000), entry(1100)] }), 'rice', TODAY)).toBeNull();
    expect(localPrice(summary({}, { rice: [entry(1000), entry(1100), entry(1200, '2026-11-01')] }), 'rice', TODAY)).toBeNull();
  });

  it('gives the average, low, high and count', () => {
    const price = localPrice(summary({}, { rice: [entry(1000), entry(1100), entry(1300, '2026-11-25')] }), 'Rice', TODAY);
    expect(price).toEqual({ crop: 'rice', avgPerMon: 1133, lowPerMon: 1000, highPerMon: 1300, farmers: 3, lastDay: TODAY });
  });

  it('ignores unbelievable prices and unknown crops', () => {
    expect(localPrice(summary({}, { rice: [entry(1000), entry(1100), entry(5)] }), 'rice', TODAY)).toBeNull();
    expect(localPrice(summary({}, {}), 'wheat', TODAY)).toBeNull();
    expect(localPrice(null, 'rice', TODAY)).toBeNull();
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
