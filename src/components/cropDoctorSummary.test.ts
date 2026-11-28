import { describe, expect, it } from 'vitest';
import {
  buildDiagnosisHeadline,
  buildDiagnosisSummary,
  toAssistantHistory,
  DIAGNOSIS_SUMMARY_MAX,
  FOLLOW_UP_HISTORY_TURNS,
} from './cropDoctorSummary';

const live = {
  status: 'Valid',
  possibleDiseases: [
    { disease: 'Early blight', score: 55, evidence: 'Concentric rings', differentiators: '' },
    { disease: 'Late blight', score: 82, evidence: 'Water-soaked edges on the leaf', differentiators: '' },
    { disease: 'Leaf spot', score: 20, evidence: '', differentiators: '' },
    { disease: 'Fourth', score: 5, evidence: '', differentiators: '' },
  ],
  diagnosis: '**Late blight** is likely.',
  qualitativeSeverity: 'High',
  confidence: 80,
  symptomsBreakdown: ['Dark patches', 'White growth under leaf'],
  verificationAdvice: 'Check the underside of leaves in the morning.',
  differentialDiagnosis: 'Not early blight because no rings.',
};

describe('buildDiagnosisSummary', () => {
  it('lists the crop, the top three causes best first, and the steps shown', () => {
    const text = buildDiagnosisSummary({
      diagnosis: live,
      deepDiagnosis: { advancedTreatment: 'Remove infected leaves.', recoveryTimeline: '2 weeks' },
      crop: 'potato',
      cropStage: 'flowering',
      lang: 'en',
    });
    expect(text).toContain('Crop: potato, stage: flowering');
    expect(text.indexOf('1. Late blight (82% match)')).toBeGreaterThan(-1);
    expect(text.indexOf('Late blight')).toBeLessThan(text.indexOf('Early blight'));
    expect(text).toContain('3. Leaf spot (20% match)');
    expect(text).not.toContain('Fourth');
    expect(text).toContain('Check first: Check the underside');
    expect(text).toContain('Detailed treatment: Remove infected leaves.');
    expect(text).toContain('Other possibilities: Not early blight');
    expect(text).not.toContain('**');
  });

  it('falls back to the single disease name for sample and old results', () => {
    const text = buildDiagnosisSummary({
      diagnosis: {
        disease: 'Rice Blast',
        diseaseBn: 'ধানের ব্লাস্ট',
        confidence: 94,
        severity: 'High',
        organicRemedy: 'Neem extract',
        chemicalRemedy: 'Tricyclazole',
        symptomsBreakdown: ['Spindle spots'],
      },
      crop: 'paddy',
      lang: 'bn',
    });
    expect(text).toContain('Diagnosis: Rice Blast');
    expect(text).toContain('Organic: Neem extract');
    expect(text).toContain('Chemical: Tricyclazole');
  });

  it('never exceeds the server limit', () => {
    const long = 'x'.repeat(5000);
    const text = buildDiagnosisSummary({
      diagnosis: { ...live, diagnosis: long, verificationAdvice: long, differentialDiagnosis: long },
      deepDiagnosis: { advancedTreatment: long, recoveryTimeline: long, environmentalContext: long },
      crop: 'potato',
      lang: 'en',
    });
    expect(text.length).toBeLessThanOrEqual(DIAGNOSIS_SUMMARY_MAX);
    expect(text.length).toBeGreaterThan(500);
  });

  it('returns an empty string when there is no diagnosis', () => {
    expect(buildDiagnosisSummary({ diagnosis: null, lang: 'en' })).toBe('');
  });
});

describe('toAssistantHistory', () => {
  it('maps model to assistant, keeps the last 12 oldest first, drops empty turns', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('model' as const),
      text: `turn ${i}`,
    }));
    msgs.push({ role: 'model', text: '   ' });
    const out = toAssistantHistory(msgs);
    expect(out).toHaveLength(FOLLOW_UP_HISTORY_TURNS);
    expect(out[out.length - 1].text).toBe('turn 19');
    expect(out[0].text).toBe('turn 8');
    expect(out[0].role).toBe('user');
    expect(out[1].role).toBe('assistant');
  });

  it('cuts each turn to 4000 characters', () => {
    const out = toAssistantHistory([{ role: 'user', text: 'a'.repeat(9000) }]);
    expect(out[0].text.length).toBe(4000);
  });
});

describe('buildDiagnosisHeadline', () => {
  it('names the top cause and the crop, in English and in Bangla', () => {
    expect(buildDiagnosisHeadline({ diagnosis: live, crop: 'Potato', lang: 'en' })).toBe('Diagnosis: Late blight (Potato)');
    expect(buildDiagnosisHeadline({ diagnosis: { ...live, diseaseBn: 'নাবি ধসা' }, crop: 'আলু', lang: 'bn' })).toBe('রোগ নির্ণয়: নাবি ধসা (আলু)');
  });

  it('falls back to the single disease name and leaves out a missing crop', () => {
    expect(buildDiagnosisHeadline({ diagnosis: { disease: 'Rice Blast' }, lang: 'en' })).toBe('Diagnosis: Rice Blast');
    expect(buildDiagnosisHeadline({ diagnosis: { disease: 'Rice Blast' }, lang: 'bn' })).toBe('রোগ নির্ণয়: Rice Blast');
  });

  it('is empty when there is nothing to name, and always a valid message length', () => {
    expect(buildDiagnosisHeadline({ diagnosis: {}, lang: 'en' })).toBe('');
    expect(buildDiagnosisHeadline({ diagnosis: null, lang: 'en' })).toBe('');
    const long = buildDiagnosisHeadline({ diagnosis: { disease: 'x'.repeat(2000) }, crop: 'y'.repeat(500), lang: 'en' });
    expect(long.length).toBeGreaterThan(0);
    expect(long.length).toBeLessThanOrEqual(300);
  });
});
