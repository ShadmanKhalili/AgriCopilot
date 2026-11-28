import { beforeEach, describe, expect, it, vi } from 'vitest';

const STAMP = Symbol('server-time');
const calls: Array<{ op: string; path?: string; data?: any }> = [];
let stored: Array<{ id: string; data: any }> = [];

vi.mock('../firestore', () => ({ db: { fake: true } }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  doc: (parent: any, ...rest: string[]) =>
    rest.length > 0 ? { path: rest.join('/'), id: rest[rest.length - 1] } : { path: `${parent.path}/auto1`, id: 'auto1' },
  query: (col: unknown, ...constraints: unknown[]) => ({ col, constraints }),
  limit: (n: number) => ({ limit: n }),
  getDocs: async () => ({
    size: stored.length,
    docs: stored.map((entry) => ({ id: entry.id, data: () => entry.data })),
  }),
  setDoc: async (ref: any, data: any) => {
    calls.push({ op: 'set', path: ref.path, data });
  },
  updateDoc: async (ref: any, data: any) => {
    calls.push({ op: 'update', path: ref.path, data });
  },
  deleteDoc: async (ref: any) => {
    calls.push({ op: 'delete', path: ref.path });
  },
  serverTimestamp: () => STAMP,
}));

import { addFact, deactivateFact, deleteFact, listFacts, updateFact } from './assistantMemory';

const fact = (over: Record<string, unknown> = {}) => ({
  text: 'My land floods every July',
  category: 'farm',
  source: 'farmer_said',
  active: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  calls.length = 0;
  stored = [];
});

describe('listFacts', () => {
  it('returns facts newest first, with switched-off ones, and skips malformed documents', async () => {
    stored = [
      { id: 'a', data: fact({ updatedAt: '2026-11-01T00:00:00.000Z' }) },
      { id: 'b', data: fact({ text: 'I use a shallow tube well', category: 'water', active: false, updatedAt: '2026-11-05T00:00:00.000Z' }) },
      { id: 'bad', data: { text: 'x' } },
    ];
    const facts = await listFacts('u1');
    expect(facts.map((f) => f.id)).toEqual(['b', 'a']);
    expect(facts[0].active).toBe(false);
  });

  it('refuses a bad uid', async () => {
    await expect(listFacts('a/b')).rejects.toThrow('memory_id_invalid');
  });
});

describe('addFact', () => {
  it('writes exactly the shape the rules expect, with the server clock', async () => {
    const id = await addFact('u1', '  I sell at the Ishwardi hat  ', 'money');
    expect(id).toBe('auto1');
    expect(calls).toEqual([
      {
        op: 'set',
        path: 'users/u1/assistant_memory/auto1',
        data: {
          text: 'I sell at the Ishwardi hat',
          category: 'money',
          source: 'farmer_said',
          createdAt: STAMP,
          updatedAt: STAMP,
          active: true,
        },
      },
    ]);
  });

  it('refuses text that is too short or too long, and an unknown category, without writing', async () => {
    await expect(addFact('u1', 'ab', 'farm')).rejects.toThrow('memory_text_invalid');
    await expect(addFact('u1', 'a'.repeat(201), 'farm')).rejects.toThrow('memory_text_invalid');
    await expect(addFact('u1', 'a fine fact', 'secret' as any)).rejects.toThrow('memory_category_invalid');
    expect(calls).toHaveLength(0);
  });

  it('refuses a 201st fact', async () => {
    stored = Array.from({ length: 200 }, (_, i) => ({ id: `f${i}`, data: fact() }));
    await expect(addFact('u1', 'one more fact', 'farm')).rejects.toThrow('memory_full');
    expect(calls).toHaveLength(0);
  });
});

describe('updateFact', () => {
  it('changes only text, source and updatedAt', async () => {
    await updateFact('u1', 'f1', ' New words here ');
    expect(calls).toEqual([
      {
        op: 'update',
        path: 'users/u1/assistant_memory/f1',
        data: { text: 'New words here', source: 'farmer_edited', updatedAt: STAMP },
      },
    ]);
  });

  it('refuses bad text or a bad id without writing', async () => {
    await expect(updateFact('u1', 'f1', 'x')).rejects.toThrow('memory_text_invalid');
    await expect(updateFact('u1', 'a/b', 'good text')).rejects.toThrow('memory_id_invalid');
    expect(calls).toHaveLength(0);
  });
});

describe('deactivateFact and deleteFact', () => {
  it('switches a fact off by changing only active and updatedAt', async () => {
    await deactivateFact('u1', 'f1');
    expect(calls).toEqual([
      { op: 'update', path: 'users/u1/assistant_memory/f1', data: { active: false, updatedAt: STAMP } },
    ]);
  });

  it('deletes a fact', async () => {
    await deleteFact('u1', 'f1');
    expect(calls).toEqual([{ op: 'delete', path: 'users/u1/assistant_memory/f1' }]);
  });

  it('refuses a bad id', async () => {
    await expect(deleteFact('u1', '')).rejects.toThrow('memory_id_invalid');
    await expect(deactivateFact('u1', 'x/y')).rejects.toThrow('memory_id_invalid');
    expect(calls).toHaveLength(0);
  });
});
