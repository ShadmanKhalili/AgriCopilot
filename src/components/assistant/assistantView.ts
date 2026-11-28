/**
 * The pure parts of the assistant screen: what is sent as history, how
 * messages are ordered, which words are shown for an error, which source
 * labels sit under an answer. No React and no Firebase here, so all of it is
 * tested without a browser.
 */

import {
  ASSISTANT_SOURCES,
  SOURCE_LABELS,
  type AssistantHistoryTurn,
  type AssistantSource,
  type AssistantToday,
} from '../../constants/assistant';
import type { AssistantErrorKind } from '../../services/assistant';
import type { ThreadMessage } from '../../services/assistantThreads';
import toBn from '../../utils/banglaNum';
import { safetyBlockMessage } from '../../utils/safetyBlock';
import type { TodayWeather } from '../../utils/todaySignals';

export type ViewLang = 'bn' | 'en';
export type ChatChannel = ThreadMessage['channel'];

/** The most turns sent as history (the server accepts 12). */
export const HISTORY_MAX_TURNS = 12;
/** The longest history turn (the server accepts 4000 characters). */
export const HISTORY_TEXT_MAX = 4000;
/** The longest question (the server accepts 2000 characters). */
export const QUESTION_MAX = 2000;
/** The longest message the farmer's account can store. */
export const SAVE_TEXT_MAX = 4000;
/** How long the screen waits for a save before it says "not saved" (a write waits for the network). */
export const SAVE_TIMEOUT_MS = 8000;
/** How long the screen waits for the saved conversation before it shows an empty one. */
export const LOAD_TIMEOUT_MS = 10000;

/** One line on the screen: a saved message, or one sent from this phone a moment ago. */
export interface ChatItem {
  /** Stable React key: the saved message's id, or a local one such as `local-3`. */
  key: string;
  role: 'user' | 'assistant';
  text: string;
  channel: ChatChannel;
  /** ISO time, or null for a message made on this phone that the server has not stamped. */
  createdAt: string | null;
  toolCalls?: { name: string; status: string }[];
  /** The sources the server named for this answer. Not stored, so saved answers have none. */
  sources?: AssistantSource[];
  /** False when the message could not be saved to the farmer's account. */
  saved: boolean;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** Cut to `max` characters without leaving half of an emoji at the end. */
export const clampText = (value: string, max: number): string => {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
};

/** The question to send: one tidy line of at most 2000 characters, or null when there is nothing to ask. */
export const cleanQuestion = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = clampText(value.replace(/\s+/g, ' ').trim(), QUESTION_MAX);
  return text || null;
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const chatItemFromThread = (message: ThreadMessage): ChatItem => ({
  key: message.id,
  role: message.role,
  text: message.text,
  channel: message.channel,
  createdAt: message.createdAt,
  ...(message.toolCalls && message.toolCalls.length > 0 ? { toolCalls: message.toolCalls } : {}),
  saved: true,
});

/**
 * Oldest first. A message with no time yet (made on this phone, not stamped by
 * the server) goes after the stamped ones, and messages that tie keep the order
 * they came in.
 */
export const orderChatItems = (items: readonly ChatItem[]): ChatItem[] =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ta = a.item.createdAt;
      const tb = b.item.createdAt;
      if (ta !== null && tb !== null) return ta === tb ? a.index - b.index : ta < tb ? -1 : 1;
      if (ta === null && tb === null) return a.index - b.index;
      return ta === null ? 1 : -1;
    })
    .map(({ item }) => item);

/**
 * The messages that are on the screen already when the saved conversation is
 * (re)loaded. The saved ones win; of the ones made on this phone, only those not
 * yet kept in the account stay (at the end), because a kept one is in `saved`
 * under its real id and would show twice.
 */
export const mergeLoadedItems = (
  saved: readonly ChatItem[],
  current: readonly ChatItem[],
  unsyncedKeys: ReadonlySet<string>
): ChatItem[] => {
  const savedKeys = new Set(saved.map((entry) => entry.key));
  return orderChatItems([...saved, ...current.filter((entry) => !savedKeys.has(entry.key) && unsyncedKeys.has(entry.key))]);
};

/**
 * The turns sent with a new question: the last 12 finished exchanges, oldest
 * first, each cut to 4000 characters.
 *  - Empty messages are left out.
 *  - A question with no answer (it failed, or it is the one being asked now) is
 *    left out, so the history always reads question, answer, question, answer.
 *  - It starts with a question, never with an answer whose question was cut off.
 *    The one exception is the crop doctor's diagnosis line (an answer on the
 *    'photo' channel): it is context for what follows, so it stays.
 */
export const buildHistory = (items: readonly (Pick<ChatItem, 'role' | 'text'> & { channel?: ChatChannel })[]): AssistantHistoryTurn[] => {
  const turns: (AssistantHistoryTurn & { diagnosis: boolean })[] = [];
  for (const item of items) {
    if (item.role !== 'user' && item.role !== 'assistant') continue;
    const text = clampText(String(item.text ?? '').trim(), HISTORY_TEXT_MAX);
    if (text) turns.push({ role: item.role, text, diagnosis: item.role === 'assistant' && item.channel === 'photo' });
  }
  const answered = turns.filter((turn, index) => turn.role !== 'user' || turns[index + 1]?.role === 'assistant');
  const recent = answered.slice(-HISTORY_MAX_TURNS);
  while (recent.length > 0 && recent[0].role !== 'user' && !recent[0].diagnosis) recent.shift();
  return recent.map(({ role, text }) => ({ role, text }));
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const ERROR_KINDS: readonly AssistantErrorKind[] = ['offline', 'limit', 'capacity', 'auth', 'server', 'blocked'];

/** The kind of a failed ask. Anything that is not an AssistantError reads as a server problem. */
export const errorKindOf = (error: unknown): AssistantErrorKind => {
  const kind = (error as { kind?: unknown } | null)?.kind;
  return typeof kind === 'string' && (ERROR_KINDS as readonly string[]).includes(kind) ? (kind as AssistantErrorKind) : 'server';
};

export interface ErrorView {
  text: string;
  /** Asking again can help (a spent daily allowance cannot be fixed by asking again). */
  canRetry: boolean;
  /** Offer the Krishi Call Centre number. */
  showHelpline: boolean;
}

export const errorView = (kind: AssistantErrorKind, lang: ViewLang): ErrorView => {
  const bn = lang === 'bn';
  switch (kind) {
    case 'blocked':
      // The same words the crop doctor shows; asking the same thing again cannot help.
      return { text: safetyBlockMessage(lang), canRetry: false, showHelpline: false };
    case 'offline':
      return {
        text: bn ? 'ইন্টারনেট নেই। সংযোগ ফিরলে আবার চেষ্টা করুন।' : 'No internet connection. Please try again when you are back online.',
        canRetry: true,
        showHelpline: false,
      };
    case 'limit':
      return {
        text: bn ? 'আজকের জিজ্ঞাসার সীমা শেষ। কাল আবার জিজ্ঞাসা করুন।' : 'You have used up your questions for today. Please ask again tomorrow.',
        canRetry: false,
        showHelpline: true,
      };
    case 'capacity':
      return {
        text: bn ? 'আজ সেবাটি খুব ব্যস্ত। একটু পরে আবার চেষ্টা করুন।' : 'The service is very busy today. Please try again a little later.',
        canRetry: true,
        showHelpline: true,
      };
    case 'auth':
      return {
        text: bn
          ? 'আপনার পরিচয় যাচাই করা যায়নি। অ্যাপ বন্ধ করে আবার খুলুন, অথবা আবার সাইন ইন করুন।'
          : 'We could not confirm who you are. Please reopen the app or sign in again.',
        canRetry: true,
        showHelpline: false,
      };
    default:
      return {
        text: bn ? 'এই মুহূর্তে উত্তর দেওয়া গেল না। একটু পরে আবার চেষ্টা করুন।' : 'Sorry, I could not answer just now. Please try again in a moment.',
        canRetry: true,
        showHelpline: true,
      };
  }
};

/** "Call the Krishi Call Centre: 16123", with Bangla numerals in Bangla. */
export const helplineText = (lang: ViewLang): string =>
  lang === 'bn' ? `কৃষি কল সেন্টারে ফোন করুন: ${toBn(16123)}` : 'Call the Krishi Call Centre: 16123';

/** Why starting a guest session failed, in words a farmer can act on. */
export const guestStartErrorText = (error: unknown, lang: ViewLang): string => {
  const bn = lang === 'bn';
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  if (code.includes('operation-not-allowed') || code.includes('admin-restricted-operation')) {
    return bn ? 'গেস্ট মোড এখন পাওয়া যাচ্ছে না। Google দিয়ে সাইন ইন করুন।' : 'Guest mode is unavailable right now. Please sign in with Google.';
  }
  if (code.includes('network-request-failed')) {
    return bn ? 'ইন্টারনেট সংযোগ নেই। আবার চেষ্টা করুন।' : 'No internet connection. Please retry.';
  }
  return bn ? 'গেস্ট হিসেবে শুরু করা যায়নি। আবার চেষ্টা করুন।' : 'Could not start as a guest. Please try again.';
};

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/**
 * Where each read tool's numbers come from. Only used for answers loaded from
 * the saved conversation, which keeps the tools used but not the sources the
 * server listed. A live answer shows the server's own list.
 */
export const SOURCE_BY_TOOL: Readonly<Record<string, readonly AssistantSource[]>> = {
  get_today_farm_actions: ['rules'],
  get_week_forecast: ['weather_forecast'],
  get_my_season: ['farmer_records'],
  get_my_money: ['farmer_records'],
  get_market_price: ['govt_bulletin'],
  get_area_warnings: ['app_data'],
  get_open_tasks: ['farmer_records'],
  lookup_disease: ['app_data'],
};

/** The sources to label under an answer, in a fixed order, each once. */
export const sourcesForItem = (item: Pick<ChatItem, 'role' | 'sources' | 'toolCalls'>): AssistantSource[] => {
  if (item.role !== 'assistant') return [];
  const found = new Set<AssistantSource>();
  if (item.sources) {
    item.sources.forEach((source) => {
      if ((ASSISTANT_SOURCES as readonly string[]).includes(source)) found.add(source);
    });
  } else {
    (item.toolCalls ?? []).forEach((call) => {
      if (call.status !== 'done') return;
      (SOURCE_BY_TOOL[call.name] ?? []).forEach((source) => found.add(source));
    });
  }
  return ASSISTANT_SOURCES.filter((source) => found.has(source));
};

export const sourceLabel = (source: AssistantSource, lang: ViewLang): string => SOURCE_LABELS[source][lang === 'en' ? 'en' : 'bn'];

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

/** The three questions offered on an empty screen. */
export const exampleQuestions = (lang: ViewLang): string[] =>
  lang === 'bn'
    ? ['আজ কি স্প্রে করতে পারি?', 'এই মৌসুমে এ পর্যন্ত কত খরচ হয়েছে?', 'আলুর দাম কত?']
    : ['Can I spray today?', 'How much have I spent this season so far?', 'What is the price of potato?'];

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The farmer's position for a request: 2 decimals (about 1 km), or nothing when there is none. */
export const requestLocation = (
  location: { latitude: number; longitude: number } | null | undefined
): { lat: number; lon: number } | undefined => {
  if (!location) return undefined;
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  return { lat: round2(latitude), lon: round2(longitude) };
};

/**
 * Today's reading as the request carries it: what Home shows, plus when it was
 * read. Nothing when there is no reading.
 */
export const todayForRequest = (
  reading: { readingAt: string; weather: TodayWeather } | null | undefined
): AssistantToday | undefined => (reading ? { readingAt: reading.readingAt, ...reading.weather } : undefined);

/** The assistant's answer as it is saved: the account stores at most 4000 characters. */
export const textForSave = (text: string): string => clampText(text.trim(), SAVE_TEXT_MAX);

/** Reject when `promise` has not settled after `ms`. The promise itself is not cancelled. */
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
