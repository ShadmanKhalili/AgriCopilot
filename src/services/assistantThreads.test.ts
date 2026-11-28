import { beforeEach, describe, expect, it, vi } from 'vitest';

const STAMP = Symbol('server-time');
const INC = Symbol('increment-1');
const ops: Array<{ op: string; path?: string; data?: any }> = [];
let threadExists = false;
/** One answer per getDoc call, used before `threadExists` (for a thread that appears mid-way). */
let existsSequence: boolean[] = [];
let setDocError: Error | null = null;
let messageDocs: Array<{ id: string; data: any }> = [];

const makeRef = (path: string) => ({ path, id: path.split('/').pop() });

vi.mock('../firestore', () => ({ db: { fake: true } }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/'), isCol: true }),
  doc: (parent: any, ...rest: string[]) =>
    rest.length > 0 ? makeRef(rest.join('/')) : makeRef(`${parent.path}/auto1`),
  query: (col: unknown, ...constraints: unknown[]) => ({ col, constraints }),
  orderBy: (field: string, dir: string) => ({ orderBy: field, dir }),
  limit: (n: number) => ({ limit: n }),
  getDoc: async () => {
    const answer = existsSequence.length > 0 ? existsSequence.shift()! : threadExists;
    return { exists: () => answer };
  },
  getDocs: async () => {
    const batchDocs = messageDocs.splice(0, 400);
    return {
      empty: batchDocs.length === 0,
      size: batchDocs.length,
      docs: batchDocs.map((m) => ({ id: m.id, data: () => m.data, ref: makeRef(`messages/${m.id}`) })),
    };
  },
  setDoc: async (ref: any, data: any) => {
    if (setDocError) throw setDocError;
    ops.push({ op: 'set', path: ref.path, data });
  },
  updateDoc: async (ref: any, data: any) => {
    ops.push({ op: 'update', path: ref.path, data });
  },
  serverTimestamp: () => STAMP,
  increment: () => INC,
  writeBatch: () => {
    const queued: Array<{ op: string; path: string; data?: any }> = [];
    return {
      set: (ref: any, data: any) => queued.push({ op: 'batch-set', path: ref.path, data }),
      update: (ref: any, data: any) => queued.push({ op: 'batch-update', path: ref.path, data }),
      delete: (ref: any) => queued.push({ op: 'batch-delete', path: ref.path }),
      commit: async () => {
        ops.push(...queued);
      },
    };
  },
}));

import {
  appendMessage,
  clearThread,
  getOrCreateMainThread,
  listMessages,
  newMessageData,
  newThreadData,
  parseThreadMessage,
  sortMessagesOldestFirst,
  threadBumpData,
  threadResetData,
} from './assistantThreads';

// The key lists in firestore.rules, copied here so a drift in either place fails a test.
const THREAD_KEYS = ['title', 'summary', 'createdAt', 'updatedAt', 'messageCount'];
const MESSAGE_REQUIRED = ['role', 'text', 'createdAt', 'channel'];
const MESSAGE_ALLOWED = [...MESSAGE_REQUIRED, 'toolCalls'];
const THREAD_UPDATE_ALLOWED = ['title', 'summary', 'updatedAt', 'messageCount'];

beforeEach(() => {
  ops.length = 0;
  threadExists = false;
  existsSequence = [];
  setDocError = null;
  messageDocs = [];
});

describe('document shapes match firestore.rules', () => {
  it('a new thread has exactly the five create keys, an int count and server times', () => {
    const data = newThreadData(STAMP);
    expect(Object.keys(data).sort()).toEqual([...THREAD_KEYS].sort());
    expect(data.createdAt).toBe(STAMP);
    expect(data.updatedAt).toBe(STAMP);
    expect(Number.isInteger(data.messageCount)).toBe(true);
    expect(data.title.length).toBeLessThanOrEqual(80);
    expect(data.summary.length).toBeLessThanOrEqual(2000);
  });

  it('a new message has the required keys and no others', () => {
    const data = newMessageData({ role: 'user', text: 'আলুর দাম কত?', channel: 'voice' }, STAMP);
    expect(Object.keys(data).sort()).toEqual([...MESSAGE_REQUIRED].sort());
    expect(data.createdAt).toBe(STAMP);
    const withTools = newMessageData(
      { role: 'assistant', text: 'ok', channel: 'text', toolCalls: [{ name: 'get_my_money', status: 'done' }] },
      STAMP
    );
    expect(Object.keys(withTools).every((k) => MESSAGE_ALLOWED.includes(k))).toBe(true);
    expect(withTools.toolCalls).toEqual([{ name: 'get_my_money', status: 'done' }]);
  });

  it('drops tool calls that the rules would refuse', () => {
    const data = newMessageData(
      {
        role: 'assistant',
        text: 'ok',
        channel: 'text',
        toolCalls: [
          { name: 'a', status: 'done' },
          { name: 'b', status: 'weird' },
          { name: 'x'.repeat(61), status: 'done' },
        ],
      },
      STAMP
    );
    expect(data.toolCalls).toEqual([{ name: 'a', status: 'done' }]);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `t${i}`, status: 'done' }));
    expect(newMessageData({ role: 'assistant', text: 'ok', channel: 'text', toolCalls: eleven }, STAMP).toolCalls).toHaveLength(10);
  });

  it('a thread update touches only keys the update rule allows', () => {
    expect(Object.keys(threadBumpData(STAMP, INC)).every((k) => THREAD_UPDATE_ALLOWED.includes(k))).toBe(true);
    expect(Object.keys(threadResetData(STAMP)).every((k) => THREAD_UPDATE_ALLOWED.includes(k))).toBe(true);
    expect(threadResetData(STAMP).messageCount).toBe(0);
  });
});

describe('parseThreadMessage / sortMessagesOldestFirst', () => {
  it('rebuilds a stored message and skips malformed ones', () => {
    const ok = parseThreadMessage('m1', {
      role: 'assistant',
      text: 'hi',
      channel: 'text',
      createdAt: '2026-11-01T00:00:00.000Z',
      toolCalls: [{ name: 'get_my_money', status: 'done' }],
    });
    expect(ok).toEqual({
      id: 'm1',
      role: 'assistant',
      text: 'hi',
      channel: 'text',
      createdAt: '2026-11-01T00:00:00.000Z',
      toolCalls: [{ name: 'get_my_money', status: 'done' }],
    });
    expect(parseThreadMessage('m2', { role: 'bot', text: 'hi', channel: 'text' })).toBeNull();
    expect(parseThreadMessage('m3', { role: 'user', text: '', channel: 'text' })).toBeNull();
    expect(parseThreadMessage('bad id', { role: 'user', text: 'x', channel: 'text' })).toBeNull();
    expect(parseThreadMessage('m4', { role: 'user', text: 'x', channel: 'text', createdAt: null })!.createdAt).toBeNull();
  });

  it('puts messages without a time last', () => {
    const m = (id: string, createdAt: string | null) => ({ id, role: 'user' as const, text: 'x', channel: 'text' as const, createdAt });
    expect(sortMessagesOldestFirst([m('c', null), m('b', '2026-11-02T00:00:00.000Z'), m('a', '2026-11-01T00:00:00.000Z')]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('getOrCreateMainThread', () => {
  it("creates the thread 'main' the first time", async () => {
    expect(await getOrCreateMainThread('u1', 'bn')).toBe('main');
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'set', path: 'users/u1/assistant_threads/main' });
    expect(Object.keys(ops[0].data).sort()).toEqual([...THREAD_KEYS].sort());
  });
  it('does not write when it exists', async () => {
    threadExists = true;
    expect(await getOrCreateMainThread('u1', 'en')).toBe('main');
    expect(ops).toHaveLength(0);
  });
  it('refuses a bad uid', async () => {
    await expect(getOrCreateMainThread('a/b', 'bn')).rejects.toThrow('thread_id_invalid');
  });
  it('shares one create between calls made at the same time', async () => {
    const results = await Promise.all([
      getOrCreateMainThread('u1', 'bn'),
      getOrCreateMainThread('u1', 'bn'),
      getOrCreateMainThread('u1', 'en'),
    ]);
    expect(results).toEqual(['main', 'main', 'main']);
    expect(ops.filter((o) => o.op === 'set')).toHaveLength(1);
  });
  it('starts a new create once the earlier one has finished', async () => {
    await getOrCreateMainThread('u1', 'bn');
    expect(ops).toHaveLength(1);
    threadExists = true;
    await getOrCreateMainThread('u1', 'bn');
    expect(ops).toHaveLength(1);
  });
  it('accepts a refused create when the thread exists after all (made on another device)', async () => {
    existsSequence = [false, true];
    setDocError = new Error('permission-denied');
    expect(await getOrCreateMainThread('u1', 'bn')).toBe('main');
  });
  it('rethrows when the create fails and the thread is still missing', async () => {
    existsSequence = [false, false];
    setDocError = new Error('unavailable');
    await expect(getOrCreateMainThread('u1', 'bn')).rejects.toThrow('unavailable');
    // The failed attempt is not remembered: the next call tries again.
    setDocError = null;
    existsSequence = [];
    expect(await getOrCreateMainThread('u1', 'bn')).toBe('main');
  });
});

describe('appendMessage', () => {
  it('writes the message and bumps the thread in one batch', async () => {
    const id = await appendMessage('u1', 'main', { role: 'user', text: '  আলুর দাম কত?  ', channel: 'voice' });
    expect(id).toBe('auto1');
    expect(ops.map((o) => o.op)).toEqual(['batch-set', 'batch-update']);
    expect(ops[0].path).toBe('users/u1/assistant_threads/main/messages/auto1');
    expect(ops[0].data).toEqual({ role: 'user', text: 'আলুর দাম কত?', channel: 'voice', createdAt: STAMP });
    expect(ops[1].path).toBe('users/u1/assistant_threads/main');
    expect(ops[1].data).toEqual({ updatedAt: STAMP, messageCount: INC });
  });
  it('refuses empty, too long, or unknown role/channel', async () => {
    await expect(appendMessage('u1', 'main', { role: 'user', text: '   ', channel: 'text' })).rejects.toThrow('message_invalid');
    await expect(appendMessage('u1', 'main', { role: 'user', text: 'x'.repeat(4001), channel: 'text' })).rejects.toThrow('message_invalid');
    await expect(appendMessage('u1', 'main', { role: 'bot' as never, text: 'x', channel: 'text' })).rejects.toThrow('message_invalid');
    await expect(appendMessage('u1', 'main', { role: 'user', text: 'x', channel: 'sms' as never })).rejects.toThrow('message_invalid');
    expect(ops).toHaveLength(0);
  });
});

describe('listMessages', () => {
  it('returns oldest first from a newest-first query and skips bad documents', async () => {
    messageDocs = [
      { id: 'c', data: { role: 'assistant', text: 'third', channel: 'text', createdAt: '2026-11-03T00:00:00.000Z' } },
      { id: 'x', data: { nope: true } },
      { id: 'b', data: { role: 'user', text: 'second', channel: 'text', createdAt: '2026-11-02T00:00:00.000Z' } },
      { id: 'a', data: { role: 'user', text: 'first', channel: 'text', createdAt: '2026-11-01T00:00:00.000Z' } },
    ];
    const list = await listMessages('u1', 'main');
    expect(list.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('clearThread', () => {
  it('deletes the messages in batches and resets the thread', async () => {
    threadExists = true;
    messageDocs = Array.from({ length: 450 }, (_, i) => ({ id: `m${i}`, data: {} }));
    await clearThread('u1', 'main');
    expect(ops.filter((o) => o.op === 'batch-delete')).toHaveLength(450);
    const last = ops[ops.length - 1];
    expect(last).toMatchObject({ op: 'update', path: 'users/u1/assistant_threads/main' });
    expect(last.data).toEqual({ title: '', summary: '', updatedAt: STAMP, messageCount: 0 });
  });
  it('recreates a missing thread instead of failing', async () => {
    await clearThread('u1', 'main');
    expect(ops[ops.length - 1]).toMatchObject({ op: 'set', path: 'users/u1/assistant_threads/main' });
  });
});
