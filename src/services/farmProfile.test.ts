import { describe, expect, it } from 'vitest';
import {
  farmProfileKey,
  fromFarmProfileDoc,
  hasOnboardingAnswers,
  mergeFarmProfile,
  shouldServerWin,
  toFarmProfileDoc,
} from './farmProfile';

const plan = { cropKey: 'rice_boro', sowingDate: '2026-12-01', completedStages: [2, 0, 2] };

describe('toFarmProfileDoc', () => {
  it('builds the full document from good settings', () => {
    const doc = toFarmProfileDoc({
      lang: 'en',
      mainCrop: '  Rice ',
      place: { district: 'Dhaka', districtBn: 'ঢাকা', upazila: 'Savar', upazilaBn: 'সাভার' },
      location: { latitude: 23.81034, longitude: 90.41256 },
      cropPlan: plan,
    });
    expect(doc).toEqual({
      schemaVersion: 1,
      lang: 'en',
      mainCrop: 'Rice',
      place: { district: 'Dhaka', districtBn: 'ঢাকা', upazila: 'Savar', upazilaBn: 'সাভার' },
      location: { latitude: 23.81, longitude: 90.413 },
      cropPlan: { cropKey: 'rice_boro', sowingDate: '2026-12-01', completedStages: [0, 2] },
    });
  });

  it('gives an empty but complete document for empty settings', () => {
    expect(toFarmProfileDoc({})).toEqual({
      schemaVersion: 1,
      lang: 'bn',
      mainCrop: null,
      place: null,
      location: null,
      cropPlan: null,
    });
  });

  it('never leaves undefined keys (Firestore rejects them)', () => {
    const doc = toFarmProfileDoc({ place: { district: 'Dhaka' } });
    expect(doc.place).toEqual({ district: 'Dhaka', districtBn: 'Dhaka' });
    expect(Object.keys(doc.place as object)).toEqual(['district', 'districtBn']);
  });

  it('drops invalid optional upazila text but keeps the district', () => {
    const doc = toFarmProfileDoc({
      place: { district: 'Dhaka', districtBn: 'ঢাকা', upazila: '   ', upazilaBn: 'x'.repeat(61) },
    });
    expect(doc.place).toEqual({ district: 'Dhaka', districtBn: 'ঢাকা' });
  });

  it('turns invalid parts into null without touching the rest', () => {
    const doc = toFarmProfileDoc({
      lang: 'fr',
      mainCrop: 'x'.repeat(41),
      place: { district: '' },
      location: { latitude: 51.5, longitude: -0.12 },
      cropPlan: { cropKey: 'rice', sowingDate: '2026-02-31', completedStages: [] },
    });
    expect(doc.lang).toBe('bn');
    expect(doc.mainCrop).toBeNull();
    expect(doc.place).toBeNull();
    expect(doc.location).toBeNull();
    expect(doc.cropPlan).toBeNull();
  });

  it('applies the rule bounds after rounding', () => {
    expect(toFarmProfileDoc({ location: { latitude: 20.4994, longitude: 90 } }).location).toBeNull();
    expect(toFarmProfileDoc({ location: { latitude: 20.4996, longitude: 90 } }).location).toEqual({
      latitude: 20.5,
      longitude: 90,
    });
    expect(toFarmProfileDoc({ location: { latitude: 20.5, longitude: 92.7 } }).location).toEqual({
      latitude: 20.5,
      longitude: 92.7,
    });
    expect(toFarmProfileDoc({ location: { latitude: 26.8, longitude: 90 } }).location).toBeNull();
    expect(toFarmProfileDoc({ location: { latitude: NaN, longitude: 90 } }).location).toBeNull();
    expect(toFarmProfileDoc({ location: { latitude: '23', longitude: 90 } }).location).toBeNull();
  });

  it('keeps at most 30 distinct whole-number stages', () => {
    const many = Array.from({ length: 40 }, (_, i) => i);
    const doc = toFarmProfileDoc({
      cropPlan: { cropKey: 'rice', sowingDate: '2026-12-01', completedStages: [...many, 1.5, -1, NaN, '3'] },
    });
    expect(doc.cropPlan?.completedStages).toHaveLength(30);
    expect(doc.cropPlan?.completedStages.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
  });

  it('has a stable key regardless of input key order', () => {
    const a = toFarmProfileDoc({ lang: 'bn', mainCrop: 'Rice' });
    const b = toFarmProfileDoc({ mainCrop: 'Rice', lang: 'bn' });
    expect(farmProfileKey(a)).toBe(farmProfileKey(b));
    expect(farmProfileKey(a)).not.toBe(farmProfileKey(toFarmProfileDoc({ lang: 'en', mainCrop: 'Rice' })));
  });
});

describe('fromFarmProfileDoc', () => {
  it('returns null for anything that is not an object', () => {
    expect(fromFarmProfileDoc(null)).toBeNull();
    expect(fromFarmProfileDoc(undefined)).toBeNull();
    expect(fromFarmProfileDoc('x')).toBeNull();
    expect(fromFarmProfileDoc([1, 2])).toBeNull();
  });

  it('round-trips a document written by toFarmProfileDoc', () => {
    const doc = toFarmProfileDoc({
      lang: 'en',
      mainCrop: 'Jute',
      place: { district: 'Rajshahi', districtBn: 'রাজশাহী' },
      location: { latitude: 24.37, longitude: 88.6 },
      cropPlan: plan,
    });
    expect(fromFarmProfileDoc({ ...doc, updatedAt: { seconds: 1 } })).toEqual(doc);
  });

  it('survives garbage fields and ignores extra ones', () => {
    const doc = fromFarmProfileDoc({
      lang: 7,
      mainCrop: { a: 1 },
      place: 'Dhaka',
      location: [1, 2],
      cropPlan: { cropKey: 5 },
      extra: true,
    });
    expect(doc).toEqual({
      schemaVersion: 1,
      lang: 'bn',
      mainCrop: null,
      place: null,
      location: null,
      cropPlan: null,
    });
  });
});

describe('mergeFarmProfile', () => {
  const dhaka = { district: 'Dhaka', districtBn: 'ঢাকা' };
  const bogura = { district: 'Bogura', districtBn: 'বগুড়া' };
  const spot = { latitude: 24.85, longitude: 89.37 };

  it('returns the device profile when the server has none', () => {
    const device = toFarmProfileDoc({ mainCrop: 'Rice' });
    expect(mergeFarmProfile(device, null)).toEqual(device);
  });

  it('keeps device values and fills the gaps from the server', () => {
    const device = toFarmProfileDoc({ mainCrop: 'Rice' });
    const server = toFarmProfileDoc({ mainCrop: 'Jute', place: bogura, location: spot, cropPlan: plan });
    const merged = mergeFarmProfile(device, server);
    expect(merged.mainCrop).toBe('Rice');
    expect(merged.place).toEqual(bogura);
    expect(merged.location).toEqual(spot);
    expect(merged.cropPlan).toEqual({ ...plan, completedStages: [0, 2] });
  });

  it('device wins when both have a value', () => {
    const device = toFarmProfileDoc({ place: dhaka });
    const server = toFarmProfileDoc({ place: bogura });
    expect(mergeFarmProfile(device, server).place).toEqual(dhaka);
  });

  it('handles a crop plan without a main crop on either side', () => {
    const planOnly = toFarmProfileDoc({ cropPlan: plan });
    const cropOnly = toFarmProfileDoc({ mainCrop: 'Jute' });
    const a = mergeFarmProfile(planOnly, cropOnly);
    expect(a.cropPlan).not.toBeNull();
    expect(a.mainCrop).toBe('Jute');
    const b = mergeFarmProfile(cropOnly, planOnly);
    expect(b.cropPlan).not.toBeNull();
    expect(b.mainCrop).toBe('Jute');
    expect(mergeFarmProfile(planOnly, toFarmProfileDoc({})).mainCrop).toBeNull();
  });

  it('serverWins prefers server values but still fills from the device', () => {
    const device = toFarmProfileDoc({ mainCrop: 'Rice', place: dhaka });
    const server = toFarmProfileDoc({ mainCrop: 'Jute', location: spot });
    const merged = mergeFarmProfile(device, server, { serverWins: true });
    expect(merged.mainCrop).toBe('Jute');
    expect(merged.place).toEqual(dhaka);
    expect(merged.location).toEqual(spot);
  });

  it('uses the server language unless the device language was chosen', () => {
    const device = toFarmProfileDoc({ lang: 'en' });
    const server = toFarmProfileDoc({ lang: 'bn' });
    expect(mergeFarmProfile(device, server).lang).toBe('en');
    expect(mergeFarmProfile(device, server, { deviceLangChosen: false }).lang).toBe('bn');
  });

  it('always yields a document the rules shape accepts (same keys as toFarmProfileDoc)', () => {
    const merged = mergeFarmProfile(toFarmProfileDoc({}), toFarmProfileDoc({ mainCrop: 'Rice' }));
    expect(Object.keys(merged)).toEqual(Object.keys(toFarmProfileDoc({})));
  });
});

describe('shouldServerWin', () => {
  it('only when a different account signs in and its profile exists', () => {
    expect(shouldServerWin('a', 'b', true)).toBe(true);
    expect(shouldServerWin('a', 'b', false)).toBe(false);
    expect(shouldServerWin('a', 'a', true)).toBe(false);
    expect(shouldServerWin(null, 'b', true)).toBe(false);
  });
});

describe('hasOnboardingAnswers', () => {
  it('is false for an empty profile and true when any answer exists', () => {
    expect(hasOnboardingAnswers(toFarmProfileDoc({}))).toBe(false);
    expect(hasOnboardingAnswers(toFarmProfileDoc({ mainCrop: 'Rice' }))).toBe(true);
    expect(hasOnboardingAnswers(toFarmProfileDoc({ place: { district: 'Dhaka' } }))).toBe(true);
    expect(hasOnboardingAnswers(toFarmProfileDoc({ cropPlan: plan }))).toBe(true);
    // A position or language alone is not an onboarding answer.
    expect(hasOnboardingAnswers(toFarmProfileDoc({ lang: 'en', location: { latitude: 23.8, longitude: 90.4 } }))).toBe(false);
  });
});
