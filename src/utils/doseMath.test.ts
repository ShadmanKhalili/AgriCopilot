import { describe, it, expect } from 'vitest';
import {
  computeDose,
  dosePerLitre,
  dosePerTank,
  toDecimals,
  DEFAULT_DOSE_BASIS,
} from './doseMath';

const base = { landSize: 10, landUnit: 'decimal' as const, tankLitres: 16 };

describe('doseMath', () => {
  it('defaults to a per-10-litre basis', () => {
    expect(DEFAULT_DOSE_BASIS).toBe(10);
  });

  it('converts every land unit to decimals', () => {
    expect(toDecimals(5, 'decimal')).toBe(5);
    expect(toDecimals(2, 'bigha')).toBe(66);
    expect(toDecimals(1, 'acre')).toBe(100);
    expect(toDecimals(10, 'katha')).toBeCloseTo(16.5);
  });

  it('derives the per-litre amount from the label basis', () => {
    expect(dosePerLitre(20, 1)).toBe(20);
    expect(dosePerLitre(20, 10)).toBe(2);
    expect(dosePerLitre(32, 16)).toBe(2);
    expect(dosePerLitre(0, 10)).toBeNull();
    expect(dosePerLitre(NaN, 10)).toBeNull();
  });

  it('a "20 ml per 10 L" label is NOT treated as 20 ml per litre', () => {
    const per10 = computeDose({ ...base, rate: 20, basisLitres: 10 });
    const per1 = computeDose({ ...base, rate: 20, basisLitres: 1 });
    expect(per10.per16LTank).toBe(32);
    expect(per1.per16LTank).toBe(320);
    expect(per1.total! / per10.total!).toBe(10);
  });

  it('per 1 L basis', () => {
    // 10 decimals -> 100 L water, 2 g per litre -> 200 g, 32 g per 16 L tank
    const r = computeDose({ ...base, rate: 2, basisLitres: 1 });
    expect(r.totalWaterLitres).toBe(100);
    expect(r.perLitre).toBe(2);
    expect(r.total).toBe(200);
    expect(r.perTank).toBe(32);
    expect(r.per16LTank).toBe(32);
    expect(r.totalTanks).toBe(7);
  });

  it('per 10 L basis', () => {
    const r = computeDose({ ...base, rate: 20, basisLitres: 10 });
    expect(r.perLitre).toBe(2);
    expect(r.total).toBe(200);
    expect(r.perTank).toBe(32);
  });

  it('per 16 L tank basis', () => {
    const r = computeDose({ ...base, rate: 30, basisLitres: 16 });
    expect(r.perTank).toBe(30);
    expect(r.per16LTank).toBe(30);
    expect(r.total).toBe(187.5);
  });

  it('keeps per-tank and per-16-L separate when the sprayer is not 16 L', () => {
    const r = computeDose({ ...base, tankLitres: 20, rate: 20, basisLitres: 10 });
    expect(r.perTank).toBe(40);
    expect(r.per16LTank).toBe(32);
    expect(r.totalTanks).toBe(5);
  });

  it('scales with bigha, acre and katha', () => {
    const bigha = computeDose({ ...base, landSize: 1, landUnit: 'bigha', rate: 20, basisLitres: 10 });
    expect(bigha.decimals).toBe(33);
    expect(bigha.totalWaterLitres).toBe(330);
    expect(bigha.total).toBe(660);

    const acre = computeDose({ ...base, landSize: 1, landUnit: 'acre', rate: 20, basisLitres: 10 });
    expect(acre.totalWaterLitres).toBe(1000);
    expect(acre.total).toBe(2000);

    const katha = computeDose({ ...base, landSize: 20, landUnit: 'katha', rate: 20, basisLitres: 10 });
    expect(katha.decimals).toBeCloseTo(33);
    expect(katha.totalWaterLitres).toBe(330);
  });

  it('returns no amounts until a rate is entered', () => {
    const r = computeDose({ ...base, rate: null, basisLitres: 10 });
    expect(r.perLitre).toBeNull();
    expect(r.perTank).toBeNull();
    expect(r.per16LTank).toBeNull();
    expect(r.total).toBeNull();
    expect(r.cost).toBeNull();
    expect(r.totalWaterLitres).toBe(100);
  });

  it('computes cost only when both rate and price are present', () => {
    const r = computeDose({ ...base, rate: 20, basisLitres: 10, pricePer100: 50 });
    expect(r.cost).toBe(100); // 200 g at 50 BDT / 100 g
    expect(computeDose({ ...base, rate: 20, basisLitres: 10 }).cost).toBeNull();
    expect(computeDose({ ...base, rate: null, basisLitres: 10, pricePer100: 50 }).cost).toBeNull();
  });

  it('dosePerTank rounds to one decimal and rejects bad input', () => {
    expect(dosePerTank(0.3, 10, 16)).toBe(0.5);
    expect(dosePerTank(20, 10, 0)).toBeNull();
    expect(dosePerTank(-1, 10, 16)).toBeNull();
  });
});
