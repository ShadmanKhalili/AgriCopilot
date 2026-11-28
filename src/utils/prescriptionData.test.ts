import { describe, it, expect } from 'vitest';
import {
  buildPrescriptionData,
  buildPrescriptionFromRecord,
  normalizeSeverity,
  isSeverityUnknown,
  stableRxId,
  toStorablePrescription,
  SEVERITY_NOT_ASSESSED,
} from './prescriptionData';
import { ESCALATION_THRESHOLD } from './diagnosisTypes';

const protocol = {
  advancedTreatment: 'রাসায়নিক:\n- Copper oxychloride, label rate\nPHI: 7 days\nজৈব:\n- Neem oil',
};

const diagnosisWith = (extra: Record<string, unknown> = {}) => ({
  possibleDiseases: [
    { disease: 'Blast', score: 95 },
    { disease: 'Brown spot', score: 10 },
  ],
  qualitativeSeverity: 'High',
  ...extra,
});

describe('chemicalGated', () => {
  it('opens the chemical section for a confident diagnosis with a protocol', () => {
    const rx = buildPrescriptionData({ diagnosis: diagnosisWith(), deepDiagnosis: protocol, lang: 'en' });
    expect(rx.confidence).toBeGreaterThanOrEqual(ESCALATION_THRESHOLD);
    expect(rx.chemicalSteps.length).toBeGreaterThan(0);
    expect(rx.chemicalGated).toBe(false);
  });

  it('gates when the protocol is missing', () => {
    const rx = buildPrescriptionData({ diagnosis: diagnosisWith(), deepDiagnosis: {}, lang: 'en' });
    expect(rx.chemicalGated).toBe(true);
  });

  it('gates when confidence is below the escalation threshold, even with a protocol', () => {
    const low = diagnosisWith({
      possibleDiseases: [
        { disease: 'Blast', score: 55 },
        { disease: 'Brown spot', score: 50 },
      ],
    });
    const rx = buildPrescriptionData({ diagnosis: low, deepDiagnosis: protocol, lang: 'en' });
    expect(rx.confidence).toBeLessThan(ESCALATION_THRESHOLD);
    expect(rx.chemicalSteps.length).toBeGreaterThan(0);
    expect(rx.chemicalGated).toBe(true);
  });

  it('gates when confidence was never established', () => {
    const rx = buildPrescriptionData({
      diagnosis: { qualitativeSeverity: 'High' },
      deepDiagnosis: protocol,
      lang: 'en',
    });
    expect(rx.confidence).toBeNull();
    expect(rx.chemicalGated).toBe(true);
  });

  it('always gates a stored record', () => {
    expect(buildPrescriptionFromRecord({ diagnosisText: 'Blast' }, 'en').chemicalGated).toBe(true);
  });
});

describe('severity is never invented', () => {
  it('keeps an explicit severity', () => {
    const rx = buildPrescriptionData({ diagnosis: diagnosisWith({ qualitativeSeverity: 'Low' }), lang: 'en' });
    expect(rx.severity).toBe('Low');
  });

  it('reports Not Assessed, not Medium, when the model gave none', () => {
    const rx = buildPrescriptionData({
      diagnosis: diagnosisWith({ qualitativeSeverity: undefined }),
      lang: 'en',
    });
    expect(rx.severity).toBe(SEVERITY_NOT_ASSESSED);
    expect(isSeverityUnknown(rx.severity)).toBe(true);
  });

  it('does the same for a stored record', () => {
    expect(buildPrescriptionFromRecord({ diagnosisText: 'x' }, 'en').severity).toBe(SEVERITY_NOT_ASSESSED);
    expect(buildPrescriptionFromRecord({ qualitativeSeverity: 'High' }, 'en').severity).toBe('High');
  });

  it('normalizeSeverity falls through to the next value and treats placeholders as missing', () => {
    expect(normalizeSeverity(undefined, 'Medium')).toBe('Medium');
    expect(normalizeSeverity('', null, 'unknown')).toBe(SEVERITY_NOT_ASSESSED);
    expect(normalizeSeverity('N/A')).toBe(SEVERITY_NOT_ASSESSED);
    expect(normalizeSeverity('যাচাই করা হয়নি (Not Assessed)')).toBe(SEVERITY_NOT_ASSESSED);
    expect(isSeverityUnknown('High')).toBe(false);
  });
});

describe('toStorablePrescription (what firestore.rules accepts)', () => {
  const base = buildPrescriptionData({ diagnosis: diagnosisWith(), deepDiagnosis: protocol, lang: 'en' });
  const KEYS = [
    'rxId', 'userId', 'farmerName', 'crop', 'diseaseName', 'severity', 'confidence', 'confidenceAssessed',
    'location', 'createdAt', 'verified', 'pathogen', 'cropStage', 'symptoms', 'culturalSteps', 'organicSteps',
    'chemicalSteps', 'chemicalGated', 'harvestIntervalDays', 'differentialDiagnosis',
  ];

  it('is never verified and only writes fields the rule lists', () => {
    const doc = toStorablePrescription({ ...base, expertVerified: true }, 'u1', 'Rahim');
    expect(doc.verified).toBe(false);
    expect(Object.keys(doc).every((key) => KEYS.includes(key))).toBe(true);
    expect(doc).not.toHaveProperty('verifiedAt');
    expect(doc).not.toHaveProperty('verifiedBy');
  });

  it('drops leading formula characters and cuts text to the rule limits', () => {
    const doc = toStorablePrescription(
      { ...base, crop: '=HYPERLINK("x")', diseaseName: 'x'.repeat(400), location: '+88 Dhaka', pathogen: '-cmd' },
      'u1',
      '@evil'
    );
    expect(doc.farmerName).toBe('evil');
    expect(doc.crop).toBe('HYPERLINK("x")');
    expect(doc.location).toBe('88 Dhaka');
    expect(doc.pathogen).toBe('cmd');
    expect((doc.diseaseName as string).length).toBe(256);
  });

  it('keeps Bangla text and caps list sizes', () => {
    const doc = toStorablePrescription(
      { ...base, crop: 'ধান', symptoms: Array.from({ length: 80 }, (_, i) => `s${i}`) },
      'u1',
      ''
    );
    expect(doc.crop).toBe('ধান');
    expect(doc.farmerName).toBe('Registered Grower');
    expect((doc.symptoms as string[]).length).toBe(50);
  });
});

describe('stableRxId', () => {
  it('is the same for the same seed and differs for another', () => {
    expect(stableRxId('a|b', 2026)).toBe(stableRxId('a|b', 2026));
    expect(stableRxId('a|b', 2026)).not.toBe(stableRxId('a|c', 2026));
    expect(stableRxId('a|b', 2026)).toMatch(/^RX-BD-2026-\d{6}$/);
  });
});
