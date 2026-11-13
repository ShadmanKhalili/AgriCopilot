import { describe, expect, it } from 'vitest';
import { matchCommodities, type BulletinItem } from './market-prices';

const item = (name: string, low = 10, high = 20): BulletinItem => ({
  name,
  low,
  high,
  changePct: 0,
  direction: 'flat',
});

const find = (items: BulletinItem[], id: string) =>
  matchCommodities(items).matched.find((entry) => entry.id === id);

describe('matchCommodities', () => {
  it('finds onion when the bulletin writes য় as one code point', () => {
    const name = 'পেঁয়াজ - দেশী';
    expect(find([item(name)], 'faridpur_onion')?.found).toBe(true);
  });

  it('finds onion when the bulletin writes য় as a letter plus a dot', () => {
    const name = 'পেঁয়াজ - দেশী';
    expect(find([item(name)], 'faridpur_onion')?.found).toBe(true);
  });

  it('finds soybean oil in either spelling form', () => {
    expect(find([item('সয়াবিন তেল')], 'soybean_oil')?.found).toBe(true);
    expect(find([item('সয়াবিন তেল')], 'soybean_oil')?.found).toBe(true);
  });

  it('prefers the first name in the match list', () => {
    const items = [item('আদা - দেশী', 150, 170), item('আদা - আমদানিকৃত', 120, 140)];
    expect(find(items, 'ctg_ginger')?.item?.low).toBe(120);
  });

  it('reports a commodity the bulletin does not carry as not found', () => {
    const result = find([item('চিনি (দেশী)')], 'faridpur_onion');
    expect(result?.found).toBe(false);
    expect(result?.item).toBeNull();
  });
});
