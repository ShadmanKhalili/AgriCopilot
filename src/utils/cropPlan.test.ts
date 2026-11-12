import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidCropPlan, loadCropPlan, saveCropPlan, toggleStageDone } from './cropPlan';

const plan = { cropKey: 'paddy', sowingDate: '2026-01-10', completedStages: [0] };

describe('toggleStageDone', () => {
  it('adds and removes without mutating', () => {
    const added = toggleStageDone(plan, 2);
    expect(added.completedStages).toEqual([0, 2]);
    expect(plan.completedStages).toEqual([0]);
    expect(toggleStageDone(added, 0).completedStages).toEqual([2]);
  });
});

describe('isValidCropPlan', () => {
  it('accepts a good plan', () => expect(isValidCropPlan(plan)).toBe(true));
  it('rejects malformed shapes', () => {
    expect(isValidCropPlan(null)).toBe(false);
    expect(isValidCropPlan('x')).toBe(false);
    expect(isValidCropPlan({ ...plan, cropKey: 5 })).toBe(false);
    expect(isValidCropPlan({ ...plan, cropKey: '' })).toBe(false);
    expect(isValidCropPlan({ ...plan, sowingDate: '10/01/2026' })).toBe(false);
    expect(isValidCropPlan({ ...plan, completedStages: 'a' })).toBe(false);
    expect(isValidCropPlan({ ...plan, completedStages: [-1] })).toBe(false);
    expect(isValidCropPlan({ ...plan, completedStages: [1.5] })).toBe(false);
  });
});

describe('load / save without a DOM', () => {
  it('does not throw and loads null', () => {
    expect(loadCropPlan()).toBeNull();
    expect(() => saveCropPlan(plan)).not.toThrow();
  });
});

describe('load / save with a stubbed storage', () => {
  let store: Record<string, string>;
  const dispatch = vi.fn();

  beforeEach(() => {
    store = {};
    dispatch.mockClear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal('window', { dispatchEvent: dispatch });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips and notifies', () => {
    saveCropPlan(plan);
    expect(JSON.parse(store.krishi_crop_plan)).toEqual(plan);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect((dispatch.mock.calls[0][0] as Event).type).toBe('krishi-crop-plan');
    expect(loadCropPlan()).toEqual(plan);
  });

  it('clears on null', () => {
    saveCropPlan(plan);
    saveCropPlan(null);
    expect(loadCropPlan()).toBeNull();
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('returns null for corrupt or malformed data', () => {
    store.krishi_crop_plan = '{not json';
    expect(loadCropPlan()).toBeNull();
    store.krishi_crop_plan = JSON.stringify({ cropKey: 'paddy' });
    expect(loadCropPlan()).toBeNull();
  });

  it('survives a throwing storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {},
    });
    expect(loadCropPlan()).toBeNull();
    expect(() => saveCropPlan(plan)).not.toThrow();
  });
});
