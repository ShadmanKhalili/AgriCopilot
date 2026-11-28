import { describe, expect, it } from 'vitest';
import { cleanAreaReport } from './area-model.ts';
import { areaWarningMessage, validateAreaReport } from './area-validate.ts';

const problem = (over: Record<string, unknown> = {}) =>
  cleanAreaReport({
    kind: 'problem',
    district: 'Pabna',
    upazila: 'Ishurdi',
    crop: 'potato',
    diseaseKey: 'potato:late-blight',
    ...over,
  })!;
const price = (over: Record<string, unknown> = {}) =>
  cleanAreaReport({ kind: 'price', district: 'Pabna', upazila: 'Ishurdi', crop: 'potato', pricePerMon: 900, ...over })!;

describe('validateAreaReport', () => {
  it('accepts a known place, crop and disease and returns catalog names', () => {
    const checked = validateAreaReport(problem())!;
    expect(checked.report).toMatchObject({ district: 'pabna', upazila: 'ishurdi', crop: 'potato', diseaseKey: 'potato_late_blight' });
    expect(checked.disease).toMatchObject({ key: 'potato:late-blight', en: 'Late blight' });
    expect(checked.cropName).toEqual({ bn: 'আলু', en: 'potato' });
  });

  it('accepts the crop id spelling the app really sends for betel leaf', () => {
    const report = problem({ crop: 'betel-leaf', diseaseKey: 'betel-leaf:phytophthora-foot-rot' });
    expect(validateAreaReport(report)?.disease?.key).toBe('betel-leaf:phytophthora-foot-rot');
  });

  it('refuses an unknown district or upazila, or an upazila of another district', () => {
    expect(validateAreaReport(problem({ district: 'Atlantis' }))).toBeNull();
    expect(validateAreaReport(problem({ upazila: 'Nowhere' }))).toBeNull();
    expect(validateAreaReport(problem({ district: 'Dhaka', upazila: 'Ishurdi' }))).toBeNull();
    expect(validateAreaReport(price({ district: 'constructor', upazila: 'x' }))).toBeNull();
    expect(validateAreaReport(price({ district: '__proto__', upazila: 'x' }))).toBeNull();
  });

  it('refuses an unknown disease, free text and a disease of a different crop', () => {
    expect(validateAreaReport(problem({ diseaseKey: 'potato:made-up-plague' }))).toBeNull();
    expect(validateAreaReport(problem({ diseaseKey: 'potato:late-blight CLICK http://evil.example' }))).toBeNull();
    expect(validateAreaReport(problem({ crop: 'tomato' }))).toBeNull();
    expect(validateAreaReport(problem({ diseaseKey: 'constructor' }))).toBeNull();
  });

  it('accepts a price only for a crop the Market screen can report', () => {
    expect(validateAreaReport(price())?.report).toMatchObject({ crop: 'potato', pricePerMon: 900 });
    expect(validateAreaReport(price({ crop: 'wheat' }))).toBeNull();
    expect(validateAreaReport(price({ crop: 'free text' }))).toBeNull();
  });
});

describe('areaWarningMessage', () => {
  it('is built only from catalog names and the count', () => {
    const message = areaWarningMessage(validateAreaReport(problem())!, 3);
    expect(message.bodyEn).toBe('Your area: 3 farmers reported Late blight on potato in the last 14 days.');
    expect(message.bodyBn).toContain('আলু');
    expect(message.bodyBn).toContain('৩ জন কৃষক');
    expect(message.bodyBn).toContain('১৪ দিনে');
    expect(message.url).toBe('/#community-radar');
    expect(message.tag).toBe('area-pabna__ishurdi__problem__potato__potato_late_blight');
  });

  it('cannot carry text that a farmer sent', () => {
    // Even if a farmer's own text were somehow in the report, the message uses the catalog's names.
    const checked = validateAreaReport(problem())!;
    const tampered = { ...checked, report: { ...checked.report, diseaseKey: '<b>free text</b>', crop: 'free text' } };
    const message = areaWarningMessage(tampered, 3);
    expect(JSON.stringify(message)).not.toContain('free text');
  });
});
