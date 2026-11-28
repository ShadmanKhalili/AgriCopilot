/**
 * Phase 9: the assistant conversation, saved in the farmer's own account.
 *
 *   users/{uid}/assistant_threads/main
 *       { title <= 80, summary <= 2000, createdAt, updatedAt, messageCount }
 *   users/{uid}/assistant_threads/main/messages/{id}
 *       { role, text 1-4000, createdAt, channel, toolCalls? }   (written once)
 *
 * Version 1 keeps one thread per farmer, with the id 'main'. The security rules
 * (firestore.rules) and the shared checks in
 * netlify/functions/_shared/assistant-memory-model.ts decide the shapes; the
 * same checks run here first so a bad message is refused before it is sent.
 *
 * Firestore is loaded on demand, so the database library stays out of the first
 * load. Times are written by the server clock (the rules require it).
 *
 * Errors are short codes: 'thread_id_invalid' and 'message_invalid'.
 */

import {
  cleanMessageInput,
  cleanToolCalls,
  isMessageChannel,
  isMessageRole,
  isValidDocId,
  toIsoTime,
  MESSAGE_TEXT_MAX,
  type MessageChannel,
} from '../../netlify/functions/_shared/assistant-memory-model';

export const MAIN_THREAD_ID = 'main';
export const DEFAULT_MESSAGE_LIMIT = 50;
/** Firestore allows 500 writes in a batch; stay well under. */
const DELETE_BATCH_SIZE = 400;

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  channel: MessageChannel;
  /** ISO time, or null while the server has not stamped it yet (a message just written on this device). */
  createdAt: string | null;
  toolCalls?: { name: string; status: string }[];
}

// ---------------------------------------------------------------------------
// Document shapes (pure). `stamp` is Firestore's serverTimestamp() and
// `count` is the value for messageCount; they are passed in so tests can use
// plain values.
// ---------------------------------------------------------------------------

/** A new thread. Keys: exactly title, summary, createdAt, updatedAt, messageCount. */
export const newThreadData = <S>(stamp: S) => ({
  title: '',
  summary: '',
  createdAt: stamp,
  updatedAt: stamp,
  messageCount: 0,
});

/** A new message. Keys: role, text, channel, createdAt, and toolCalls only when there are some. */
export const newMessageData = <S>(
  input: { role: 'user' | 'assistant'; text: string; channel: MessageChannel; toolCalls?: { name: string; status: string }[] },
  stamp: S
) => {
  const calls = cleanToolCalls(input.toolCalls);
  return {
    role: input.role,
    text: input.text,
    channel: input.channel,
    createdAt: stamp,
    ...(calls.length > 0 ? { toolCalls: calls } : {}),
  };
};

/** The change to a thread when a message is added: only updatedAt and messageCount (an int). */
export const threadBumpData = <S, C>(stamp: S, count: C) => ({ updatedAt: stamp, messageCount: count });

/** The change that empties a thread: title and summary cleared, count back to 0. */
export const threadResetData = <S>(stamp: S) => ({ title: '', summary: '', updatedAt: stamp, messageCount: 0 });

/** Rebuild a message from untrusted stored data. Null when it is not one. */
export const parseThreadMessage = (id: string, data: unknown): ThreadMessage | null => {
  if (!isValidDocId(id) || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isMessageRole(d.role) || !isMessageChannel(d.channel)) return null;
  if (typeof d.text !== 'string' || d.text.length < 1 || d.text.length > MESSAGE_TEXT_MAX) return null;
  const calls = cleanToolCalls(d.toolCalls);
  return {
    id,
    role: d.role,
    text: d.text,
    channel: d.channel,
    createdAt: toIsoTime(d.createdAt),
    ...(calls.length > 0 ? { toolCalls: calls } : {}),
  };
};

/** Oldest first; a message without a time yet (just written here) goes last. */
export const sortMessagesOldestFirst = (messages: ThreadMessage[]): ThreadMessage[] =>
  [...messages].sort((a, b) => {
    if (a.createdAt === b.createdAt) return 0;
    if (a.createdAt === null) return 1;
    if (b.createdAt === null) return -1;
    return a.createdAt.localeCompare(b.createdAt);
  });

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

const loadFirestore = async () => {
  const [fs, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
  return { fs, db };
};

const requireId = (id: unknown): string => {
  if (!isValidDocId(id)) throw new Error('thread_id_invalid');
  return id;
};

// One create at a time per farmer: the Ask screen and the crop doctor can both
// ask for the thread in the same moment on a first visit.
const inFlightThreads = new Map<string, Promise<string>>();

const ensureMainThread = async (owner: string): Promise<string> => {
  const { fs, db } = await loadFirestore();
  const ref = fs.doc(db, 'users', owner, 'assistant_threads', MAIN_THREAD_ID);
  const existing = await fs.getDoc(ref);
  if (!existing.exists()) {
    try {
      await fs.setDoc(ref, newThreadData(fs.serverTimestamp()));
    } catch (error) {
      // Another device (or tab) may have created it a moment ago, which the
      // rules refuse as an overwrite. If it exists now, that is fine.
      let nowExists = false;
      try {
        nowExists = (await fs.getDoc(ref)).exists();
      } catch {
        nowExists = false;
      }
      if (!nowExists) throw error;
    }
  }
  return MAIN_THREAD_ID;
};

/**
 * The farmer's one thread, created the first time. Returns its id ('main').
 * Calls made while one is in progress for the same farmer share its result.
 * `lang` is accepted for later (a titled thread); the title stays empty for now.
 */
export function getOrCreateMainThread(uid: string, _lang: 'bn' | 'en'): Promise<string> {
  let owner: string;
  try {
    owner = requireId(uid);
  } catch (error) {
    return Promise.reject(error);
  }
  const running = inFlightThreads.get(owner);
  if (running) return running;
  const started = ensureMainThread(owner).finally(() => {
    if (inFlightThreads.get(owner) === started) inFlightThreads.delete(owner);
  });
  inFlightThreads.set(owner, started);
  return started;
}

/** The last `limit` messages (default 50), oldest first. A document that is not a message is skipped. */
export async function listMessages(uid: string, threadId: string, limit: number = DEFAULT_MESSAGE_LIMIT): Promise<ThreadMessage[]> {
  const owner = requireId(uid);
  const thread = requireId(threadId);
  const count = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 500) : DEFAULT_MESSAGE_LIMIT;
  const { fs, db } = await loadFirestore();
  const col = fs.collection(db, 'users', owner, 'assistant_threads', thread, 'messages');
  const snapshot = await fs.getDocs(fs.query(col, fs.orderBy('createdAt', 'desc'), fs.limit(count)));
  const messages: ThreadMessage[] = [];
  snapshot.docs.forEach((entry) => {
    const message = parseThreadMessage(entry.id, entry.data());
    if (message) messages.push(message);
  });
  // Newest-first from the server; the screen wants oldest first.
  return sortMessagesOldestFirst(messages.reverse());
}

/**
 * Save one message and bump the thread (updatedAt, messageCount + 1) in a single
 * batch. Returns the new message id. Refused ('message_invalid') when the text is
 * empty or over 4000 characters, or the role or channel is unknown.
 */
export async function appendMessage(
  uid: string,
  threadId: string,
  msg: Omit<ThreadMessage, 'id' | 'createdAt'>
): Promise<string> {
  const owner = requireId(uid);
  const thread = requireId(threadId);
  const clean = cleanMessageInput(msg);
  if (!clean) throw new Error('message_invalid');
  const { fs, db } = await loadFirestore();
  const threadRef = fs.doc(db, 'users', owner, 'assistant_threads', thread);
  const messageRef = fs.doc(fs.collection(db, 'users', owner, 'assistant_threads', thread, 'messages'));
  const stamp = fs.serverTimestamp();
  const batch = fs.writeBatch(db);
  batch.set(messageRef, newMessageData(clean, stamp));
  // increment() keeps messageCount an integer without reading the thread first.
  batch.update(threadRef, threadBumpData(stamp, fs.increment(1)));
  await batch.commit();
  return messageRef.id;
}

/** Delete every message of the thread (in batches), then reset the thread itself. */
export async function clearThread(uid: string, threadId: string): Promise<void> {
  const owner = requireId(uid);
  const thread = requireId(threadId);
  const { fs, db } = await loadFirestore();
  const col = fs.collection(db, 'users', owner, 'assistant_threads', thread, 'messages');
  // Each pass removes up to DELETE_BATCH_SIZE messages; stop when none are left.
  for (;;) {
    const snapshot = await fs.getDocs(fs.query(col, fs.limit(DELETE_BATCH_SIZE)));
    if (snapshot.empty) break;
    const batch = fs.writeBatch(db);
    snapshot.docs.forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
    if (snapshot.size < DELETE_BATCH_SIZE) break;
  }
  const threadRef = fs.doc(db, 'users', owner, 'assistant_threads', thread);
  const current = await fs.getDoc(threadRef);
  if (current.exists()) {
    await fs.updateDoc(threadRef, threadResetData(fs.serverTimestamp()));
  } else {
    await fs.setDoc(threadRef, newThreadData(fs.serverTimestamp()));
  }
}
