/**
 * Per-device read markers for expert consultations.
 *
 * The consultation document only carries `lastMessageAt` and
 * `lastMessageSenderRole`; there is no unread counter. Rather than adding
 * Firestore fields (which would need another rules deploy), we remember when
 * the farmer last opened each case on this device. The badge is therefore a
 * convenience, never a source of truth — chat messages themselves still get
 * `readAt` in Firestore via `markMessagesRead`.
 */

import type { Consultation } from './expertTypes';

const STORAGE_KEY = 'agri.expertReadAt.v1';
export const EXPERT_READ_EVENT = 'agri:expert-read';

type ReadMap = Record<string, number>;

const readMap = (): ReadMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ReadMap) : {};
  } catch {
    return {};
  }
};

/** True when the expert authored the last message and it is newer than our marker. */
export const isConsultationUnread = (
  consultation: Consultation,
  map: ReadMap = readMap()
): boolean => {
  if (consultation.status === 'cancelled') return false;
  if (consultation.lastMessageSenderRole !== 'expert') return false;
  if (!consultation.lastMessageAt) return false;
  const at = Date.parse(consultation.lastMessageAt);
  if (!Number.isFinite(at)) return false;
  return at > (map[consultation.id] || 0);
};

/**
 * Mark a case as read. Pass the expert's `lastMessageAt` timestamp rather than
 * Date.now() so a wrong device clock cannot keep a badge stuck.
 */
export const markConsultationRead = (id: string, atMs: number = Date.now()): void => {
  try {
    const map = readMap();
    map[id] = Math.max(atMs, map[id] || 0);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Private mode / quota — the badge is non-critical.
  }
  try {
    window.dispatchEvent(new CustomEvent(EXPERT_READ_EVENT, { detail: { id, atMs } }));
  } catch {
    // ignore
  }
};
