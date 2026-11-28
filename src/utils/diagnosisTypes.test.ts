import { describe, it, expect } from 'vitest';
import { resolveDiagnosisRecordFields, MAX_SYMPTOM_ENTRIES, AUTO_DETECTED } from './diagnosisTypes';
import { SEVERITY_NOT_ASSESSED } from './severity';

describe('resolveDiagnosisRecordFields severity', () => {
  it('keeps a stated Low / Medium / High', () => {
    for (const severity of ['Low', 'Medium', 'High']) {
      expect(resolveDiagnosisRecordFields({ severity }).qualitativeSeverity).toBe(severity);
    }
  });

  it('accepts the stated severity in any letter case', () => {
    expect(resolveDiagnosisRecordFields({ severity: 'high' }).qualitativeSeverity).toBe('High');
  });

  it('stores Not Assessed, not an invented Medium, when severity is missing or unknown', () => {
    for (const severity of [undefined, null, '', 'unknown', 'N/A', 'Not Assessed', 'Critical', 'banana']) {
      expect(resolveDiagnosisRecordFields({ severity }).qualitativeSeverity).toBe(SEVERITY_NOT_ASSESSED);
    }
  });
});

describe('resolveDiagnosisRecordFields other fields', () => {
  it('marks an auto-detected crop and stage, and defaults the analysis type', () => {
    const fields = resolveDiagnosisRecordFields({});
    expect(fields.crop).toBe(AUTO_DETECTED);
    expect(fields.cropStage).toBe(AUTO_DETECTED);
    expect(fields.analysisType).toBe('disease');
  });

  it('caps the symptom list at the rule limit and stringifies entries', () => {
    const symptoms = Array.from({ length: MAX_SYMPTOM_ENTRIES + 10 }, (_, i) => i);
    const fields = resolveDiagnosisRecordFields({ symptoms });
    expect(fields.symptomsBreakdown).toHaveLength(MAX_SYMPTOM_ENTRIES);
    expect(fields.symptomsBreakdown[0]).toBe('0');
  });
});
