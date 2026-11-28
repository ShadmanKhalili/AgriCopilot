/**
 * Phase 8: the assistant's memory and conversation. Shared shapes, limits and
 * checks. Pure: no network, no storage, no imports. The browser
 * (src/services/assistantMemory.ts), the server and the tests all use this
 * file, and firestore.rules mirrors the same limits.
 *
 * Firestore layout (all under the farmer's own account, owner-only):
 *   users/{uid}/assistant_memory/{factId}
 *       { text 3-200, category, source, createdAt, updatedAt, active }
 *       Short facts the farmer told the assistant ("my land floods every July").
 *       The farmer can see, edit, switch off and delete each one.
 *   users/{uid}/assistant_threads/{threadId}
 *       { title <= 80, summary <= 2000, createdAt, updatedAt, messageCount }
 *   users/{uid}/assistant_threads/{threadId}/messages/{msgId}
 *       { role, text <= 4000, createdAt, channel, toolCalls? (<= 10) }
 *       Written once, never edited.
 *
 * `createdAt` / `updatedAt` are Firestore timestamps set from the server clock
 * (the rules require them to equal `request.time`). When read back they are
 * turned into ISO strings by `toIsoTime`.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const MEMORY_TEXT_MIN = 3;
export const MEMORY_TEXT_MAX = 200;
/** Client-side guard: the most facts one farmer keeps. The rules do not count. */
export const MEMORY_FACT_LIMIT = 200;

export const THREAD_TITLE_MAX = 80;
export const THREAD_SUMMARY_MAX = 2000;
export const THREAD_MESSAGE_COUNT_MAX = 100_000;

export const MESSAGE_TEXT_MAX = 4000;
export const TOOL_CALLS_MAX = 10;
export const TOOL_NAME_MAX = 60;

// ---------------------------------------------------------------------------
// Memory facts
// ---------------------------------------------------------------------------

export type MemoryCategory = 'farm' | 'crop' | 'water' | 'money' | 'family' | 'preference' | 'other';
export const MEMORY_CATEGORIES: readonly MemoryCategory[] = [
  'farm',
  'crop',
  'water',
  'money',
  'family',
  'preference',
  'other',
];

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, { bn: string; en: string }> = {
  farm: { bn: 'খামার ও জমি', en: 'Farm and land' },
  crop: { bn: 'ফসল', en: 'Crops' },
  water: { bn: 'পানি ও সেচ', en: 'Water and irrigation' },
  money: { bn: 'টাকাপয়সা', en: 'Money' },
  family: { bn: 'পরিবার', en: 'Family' },
  preference: { bn: 'পছন্দ', en: 'Preferences' },
  other: { bn: 'অন্যান্য', en: 'Other' },
};

/** Who wrote the fact: said by the farmer, or later edited by the farmer. */
export type MemorySource = 'farmer_said' | 'farmer_edited';
export const MEMORY_SOURCES: readonly MemorySource[] = ['farmer_said', 'farmer_edited'];

/** What a memory document holds. */
export interface MemoryFactDoc {
  text: string;
  category: MemoryCategory;
  source: MemorySource;
  /** Firestore timestamp (server clock) when written; an ISO string once read by `parseMemoryFact`. */
  createdAt: unknown;
  updatedAt: unknown;
  active: boolean;
}

/** A fact as the app uses it. */
export interface MemoryFact {
  id: string;
  text: string;
  category: MemoryCategory;
  source: MemorySource;
  /** ISO time, or '' when the server has not stamped it yet (a pending local write). */
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export const isMemoryCategory = (value: unknown): value is MemoryCategory =>
  typeof value === 'string' && (MEMORY_CATEGORIES as readonly string[]).includes(value);

export const isMemorySource = (value: unknown): value is MemorySource =>
  typeof value === 'string' && (MEMORY_SOURCES as readonly string[]).includes(value);

/** Firestore document ids the app accepts (same rule as firestore.rules `isValidId`). */
export const isValidDocId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

// Control characters (including line breaks) are not part of a one-line fact.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]+/g;

/** One tidy line: control characters and runs of spaces become a single space. */
export const tidyLine = (value: unknown): string =>
  typeof value === 'string' ? value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim() : '';

/**
 * The text of a fact, tidied. Null when it is not a string or is not 3-200
 * characters long. Too long is refused, not cut: a half sentence would change
 * what the farmer meant.
 */
export const cleanMemoryText = (value: unknown): string | null => {
  const text = tidyLine(value);
  return text.length >= MEMORY_TEXT_MIN && text.length <= MEMORY_TEXT_MAX ? text : null;
};

export interface MemoryFactInput {
  text: string;
  category: MemoryCategory;
}

/** Check and tidy a new fact. Null when it is not believable. An unknown category is refused. */
export const cleanMemoryInput = (input: unknown): MemoryFactInput | null => {
  if (!input || typeof input !== 'object') return null;
  const { text, category } = input as Record<string, unknown>;
  const clean = cleanMemoryText(text);
  if (!clean || !isMemoryCategory(category)) return null;
  return { text: clean, category };
};

/**
 * An ISO string for whatever a timestamp arrives as: an ISO string, a Date,
 * a Firestore `Timestamp` (has `toDate`) or a `{seconds}` object. Null when it
 * is none of these (for example a server timestamp that is still pending).
 */
export const toIsoTime = (value: unknown): string | null => {
  try {
    if (typeof value === 'string') {
      const ms = Date.parse(value);
      return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    }
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      if (typeof v.toDate === 'function') {
        const date = (v.toDate as () => unknown).call(value);
        return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
      }
      const seconds = typeof v.seconds === 'number' ? v.seconds : typeof v._seconds === 'number' ? v._seconds : null;
      if (seconds !== null) {
        const nanos = typeof v.nanoseconds === 'number' ? v.nanoseconds : typeof v._nanoseconds === 'number' ? v._nanoseconds : 0;
        return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString();
      }
    }
  } catch {
    // fall through
  }
  return null;
};

/** Rebuild a fact from untrusted stored data. Null when it is not one. */
export const parseMemoryFact = (id: string, data: unknown): MemoryFact | null => {
  if (!isValidDocId(id) || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const text = cleanMemoryText(d.text);
  if (!text || !isMemoryCategory(d.category) || !isMemorySource(d.source) || typeof d.active !== 'boolean') return null;
  return {
    id,
    text,
    category: d.category,
    source: d.source,
    createdAt: toIsoTime(d.createdAt) ?? '',
    updatedAt: toIsoTime(d.updatedAt) ?? toIsoTime(d.createdAt) ?? '',
    active: d.active,
  };
};

/** Newest first (by `updatedAt`, then `createdAt`, then id so the order is always the same). */
export const sortMemoryFacts = <T extends Pick<MemoryFact, 'id' | 'createdAt' | 'updatedAt'>>(facts: T[]): T[] =>
  [...facts].sort(
    (a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
  );

/**
 * The document a new fact is stored as. `stamp` is the server timestamp the
 * caller supplies (Firestore's `serverTimestamp()`); the rules require both
 * times to equal the server clock and `source` to be 'farmer_said'.
 */
export const newMemoryFactData = <S>(input: MemoryFactInput, stamp: S) => ({
  text: input.text,
  category: input.category,
  source: 'farmer_said' as const,
  createdAt: stamp,
  updatedAt: stamp,
  active: true,
});

/** An edit that changes the text (and so marks the fact as edited by the farmer). */
export const memoryTextChange = <S>(text: string, stamp: S) => ({
  text,
  source: 'farmer_edited' as const,
  updatedAt: stamp,
});

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant';
export const MESSAGE_ROLES: readonly MessageRole[] = ['user', 'assistant'];

export type MessageChannel = 'text' | 'voice' | 'live' | 'photo';
export const MESSAGE_CHANNELS: readonly MessageChannel[] = ['text', 'voice', 'live', 'photo'];

export type ToolCallStatus = 'proposed' | 'confirmed' | 'declined' | 'done' | 'failed';
export const TOOL_CALL_STATUSES: readonly ToolCallStatus[] = ['proposed', 'confirmed', 'declined', 'done', 'failed'];

export interface ToolCallRecord {
  name: string;
  status: ToolCallStatus;
}

/** What a thread document holds. */
export interface ThreadDoc {
  title: string;
  summary: string;
  createdAt: unknown;
  updatedAt: unknown;
  messageCount: number;
}

/** What a message document holds. */
export interface MessageDoc {
  role: MessageRole;
  text: string;
  createdAt: unknown;
  channel: MessageChannel;
  toolCalls?: ToolCallRecord[];
}

export const isMessageRole = (value: unknown): value is MessageRole =>
  typeof value === 'string' && (MESSAGE_ROLES as readonly string[]).includes(value);

export const isMessageChannel = (value: unknown): value is MessageChannel =>
  typeof value === 'string' && (MESSAGE_CHANNELS as readonly string[]).includes(value);

export const isToolCallStatus = (value: unknown): value is ToolCallStatus =>
  typeof value === 'string' && (TOOL_CALL_STATUSES as readonly string[]).includes(value);

/** A thread title: one tidy line of at most 80 characters (cut, since a title is only a label). */
export const cleanThreadTitle = (value: unknown): string => tidyLine(value).slice(0, THREAD_TITLE_MAX);

/** A rolling summary: tidy text of at most 2000 characters. Line breaks are kept as single newlines. */
export const cleanThreadSummary = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
    .slice(0, THREAD_SUMMARY_MAX);
};

/** Tool calls recorded on a message. Anything not shaped right is dropped; at most 10 are kept. */
export const cleanToolCalls = (value: unknown): ToolCallRecord[] => {
  if (!Array.isArray(value)) return [];
  const out: ToolCallRecord[] = [];
  for (const item of value) {
    if (out.length >= TOOL_CALLS_MAX) break;
    if (!item || typeof item !== 'object') continue;
    const name = tidyLine((item as Record<string, unknown>).name);
    const status = (item as Record<string, unknown>).status;
    if (!name || name.length > TOOL_NAME_MAX || !isToolCallStatus(status)) continue;
    out.push({ name, status });
  }
  return out;
};

export interface MessageInput {
  role: MessageRole;
  text: string;
  channel: MessageChannel;
  toolCalls?: ToolCallRecord[];
}

/**
 * Check and tidy a message before it is stored. Null when the role or channel
 * is unknown, or the text is empty or longer than 4000 characters. The text
 * keeps its line breaks. `toolCalls` is left out when there are none.
 */
export const cleanMessageInput = (input: unknown): MessageInput | null => {
  if (!input || typeof input !== 'object') return null;
  const { role, text, channel, toolCalls } = input as Record<string, unknown>;
  if (!isMessageRole(role) || !isMessageChannel(channel) || typeof text !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const body = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, ' ').trim();
  if (body.length < 1 || body.length > MESSAGE_TEXT_MAX) return null;
  const calls = cleanToolCalls(toolCalls);
  return { role, text: body, channel, ...(calls.length > 0 ? { toolCalls: calls } : {}) };
};

/** True when a thread's counters are believable. */
export const isValidMessageCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= THREAD_MESSAGE_COUNT_MAX;
