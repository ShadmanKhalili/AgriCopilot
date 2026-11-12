/**
 * Crop recovery log — the farmer's own notes after a diagnosis.
 *
 * Signed-in farmers with a saved diagnosis: Firestore at
 *   users/{uid}/recoveryLogs/{logId}
 * Everyone else: text-only copy in localStorage on this device.
 *
 * The Firestore document shape is fixed (security rules match it exactly):
 *   { uid, diagnosisId, date, action, change, createdAt }
 * Photos are never stored here.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firestore';

export const RECOVERY_LOG_LIMIT = 50;
export const RECOVERY_TEXT_MAX = 500;
export const DIAGNOSIS_ID_MAX = 128;

export interface RecoveryLogEntry {
  /** Firestore document id, or a local id for device-only entries. */
  id: string;
  diagnosisId: string;
  /** 'YYYY-MM-DD' picked by the farmer. */
  date: string;
  action: string;
  change: string;
  /** ISO timestamp. */
  createdAt: string;
}

export interface RecoveryLogInput {
  diagnosisId: string;
  date: string;
  action: string;
  change: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const clampText = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * Trim and clamp an entry to the stored limits. Returns null when it cannot
 * be stored (no diagnosis id, or both action and change are empty).
 */
export const normaliseRecoveryInput = (
  input: RecoveryLogInput
): RecoveryLogInput | null => {
  const diagnosisId = clampText(input.diagnosisId, DIAGNOSIS_ID_MAX);
  const action = clampText(input.action, RECOVERY_TEXT_MAX);
  const change = clampText(input.change, RECOVERY_TEXT_MAX);
  const rawDate = clampText(input.date, 10);
  const date = DATE_RE.test(rawDate) ? rawDate : todayIso();
  if (!diagnosisId) return null;
  if (!action && !change) return null;
  return { diagnosisId, date, action, change };
};

/** Newest farmer-picked date first; createdAt breaks ties. */
export const sortRecoveryLogs = (entries: RecoveryLogEntry[]): RecoveryLogEntry[] =>
  [...entries].sort((a, b) =>
    a.date === b.date
      ? b.createdAt.localeCompare(a.createdAt)
      : b.date.localeCompare(a.date)
  );

const logsCollection = (uid: string) => collection(db, 'users', uid, 'recoveryLogs');

/**
 * Save one entry. The document id is generated on the client, so the caller
 * gets a stable id immediately; the returned promise settles when Firestore
 * accepts or rejects the write (it may stay pending while offline).
 */
export const addRecoveryLog = (
  uid: string,
  entry: RecoveryLogInput
): { entry: RecoveryLogEntry; saved: Promise<void> } => {
  const clean = normaliseRecoveryInput(entry);
  if (!uid || !clean) {
    throw new Error('recoveryLog: entry needs a user, a diagnosis and an action or a change');
  }
  const ref = doc(logsCollection(uid));
  const createdAt = new Date().toISOString();
  const saved = setDoc(ref, {
    uid,
    diagnosisId: clean.diagnosisId,
    date: clean.date,
    action: clean.action,
    change: clean.change,
    createdAt,
  });
  return { entry: { id: ref.id, ...clean, createdAt }, saved };
};

/** Entries for one diagnosis, newest first. Single equality filter, no composite index. */
export const listRecoveryLogs = async (
  uid: string,
  diagnosisId: string
): Promise<RecoveryLogEntry[]> => {
  if (!uid || !diagnosisId) return [];
  const snap = await getDocs(
    query(
      logsCollection(uid),
      // The filter on `uid` lets the security rules prove every row is the caller's own.
      where('uid', '==', uid),
      where('diagnosisId', '==', diagnosisId),
      limit(RECOVERY_LOG_LIMIT)
    )
  );
  const entries = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      diagnosisId: clampText(data.diagnosisId, DIAGNOSIS_ID_MAX),
      date: clampText(data.date, 10),
      action: clampText(data.action, RECOVERY_TEXT_MAX),
      change: clampText(data.change, RECOVERY_TEXT_MAX),
      createdAt: clampText(data.createdAt, 40),
    };
  });
  return sortRecoveryLogs(entries);
};

export const deleteRecoveryLog = async (uid: string, logId: string): Promise<void> => {
  if (!uid || !logId) return;
  await deleteDoc(doc(db, 'users', uid, 'recoveryLogs', logId));
};

// ---------------------------------------------------------------------------
// Device-only copy (no account or no saved diagnosis). Text only.
// ---------------------------------------------------------------------------

export const localRecoveryLogKey = (diagnosisId?: string | null): string =>
  `krishi_recovery_log_${clampText(diagnosisId, DIAGNOSIS_ID_MAX) || 'local'}`;

export const loadLocalRecoveryLogs = (diagnosisId?: string | null): RecoveryLogEntry[] => {
  try {
    const raw = window.localStorage.getItem(localRecoveryLogKey(diagnosisId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: RecoveryLogEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const id = clampText(item.id, 64);
      const action = clampText(item.action, RECOVERY_TEXT_MAX);
      const change = clampText(item.change, RECOVERY_TEXT_MAX);
      if (!id || (!action && !change)) continue;
      entries.push({
        id,
        diagnosisId: clampText(item.diagnosisId, DIAGNOSIS_ID_MAX),
        date: clampText(item.date, 10),
        action,
        change,
        createdAt: clampText(item.createdAt, 40),
      });
    }
    return sortRecoveryLogs(entries).slice(0, RECOVERY_LOG_LIMIT);
  } catch {
    return [];
  }
};

export const saveLocalRecoveryLogs = (
  diagnosisId: string | null | undefined,
  entries: RecoveryLogEntry[]
): boolean => {
  try {
    const textOnly = sortRecoveryLogs(entries)
      .slice(0, RECOVERY_LOG_LIMIT)
      .map(({ id, diagnosisId: dId, date, action, change, createdAt }) => ({
        id,
        diagnosisId: dId,
        date,
        action,
        change,
        createdAt,
      }));
    window.localStorage.setItem(localRecoveryLogKey(diagnosisId), JSON.stringify(textOnly));
    return true;
  } catch {
    return false;
  }
};

/** Build a device-only entry (same clamping as the Firestore path). */
export const makeLocalRecoveryLog = (entry: RecoveryLogInput): RecoveryLogEntry | null => {
  const clean = normaliseRecoveryInput({ ...entry, diagnosisId: entry.diagnosisId || 'local' });
  if (!clean) return null;
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...clean,
    createdAt: new Date().toISOString(),
  };
};
