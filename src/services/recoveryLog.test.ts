import { describe, expect, it, vi } from 'vitest';

vi.mock('../firestore', () => ({ db: {} }));

import {
  localRecoveryLogKey,
  normaliseRecoveryInput,
  sortRecoveryLogs,
  RECOVERY_TEXT_MAX,
  type RecoveryLogEntry,
} from './recoveryLog';

describe('normaliseRecoveryInput', () => {
  it('trims and clamps text to the stored limits', () => {
    const out = normaliseRecoveryInput({
      diagnosisId: '  d1  ',
      date: '2026-11-12',
      action: '  sprayed  ',
      change: 'x'.repeat(RECOVERY_TEXT_MAX + 20),
    });
    expect(out).toEqual({
      diagnosisId: 'd1',
      date: '2026-11-12',
      action: 'sprayed',
      change: 'x'.repeat(RECOVERY_TEXT_MAX),
    });
  });

  it('needs an action or a change', () => {
    expect(normaliseRecoveryInput({ diagnosisId: 'd1', date: '2026-11-12', action: ' ', change: '' })).toBeNull();
    expect(normaliseRecoveryInput({ diagnosisId: 'd1', date: '2026-11-12', action: '', change: 'dry' })).not.toBeNull();
  });

  it('needs a diagnosis id and clamps it to 128 chars', () => {
    expect(normaliseRecoveryInput({ diagnosisId: '', date: '2026-11-12', action: 'a', change: '' })).toBeNull();
    const out = normaliseRecoveryInput({ diagnosisId: 'd'.repeat(200), date: '2026-11-12', action: 'a', change: '' });
    expect(out?.diagnosisId).toHaveLength(128);
  });

  it('replaces a malformed date with today', () => {
    const out = normaliseRecoveryInput({ diagnosisId: 'd1', date: 'yesterday', action: 'a', change: '' });
    expect(out?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('sortRecoveryLogs', () => {
  const e = (id: string, date: string, createdAt: string): RecoveryLogEntry => ({
    id, diagnosisId: 'd1', date, action: 'a', change: '', createdAt,
  });

  it('puts the newest date first, then newest createdAt', () => {
    const sorted = sortRecoveryLogs([
      e('a', '2026-11-01', '2026-11-01T10:00:00Z'),
      e('b', '2026-11-05', '2026-11-05T09:00:00Z'),
      e('c', '2026-11-05', '2026-11-05T12:00:00Z'),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('localRecoveryLogKey', () => {
  it('falls back to local when there is no diagnosis', () => {
    expect(localRecoveryLogKey(null)).toBe('krishi_recovery_log_local');
    expect(localRecoveryLogKey('abc')).toBe('krishi_recovery_log_abc');
  });
});
