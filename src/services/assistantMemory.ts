/**
 * What the assistant remembers about the farmer, from the app's side.
 *
 *   users/{uid}/assistant_memory/{factId}
 *       { text 3-200, category, source, createdAt, updatedAt, active }
 *
 * The farmer owns this list: they can see every fact, edit its text, switch it
 * off (the assistant then ignores it) or delete it. The security rules match
 * these shapes exactly (see firestore.rules and
 * netlify/functions/_shared/assistant-memory-model.ts), and the same
 * validators run here first so a bad value is refused before it is sent.
 *
 * Firestore is loaded on demand, so the database library stays out of the first
 * load. Times are written by the server clock (the rules require it).
 *
 * Unlike the area reports, a failed write is not hidden: the farmer asked for
 * it, so these functions throw and the screen says it did not save. The error
 * messages are short codes: 'memory_text_invalid', 'memory_category_invalid',
 * 'memory_id_invalid' and 'memory_full'.
 */

import {
  MEMORY_FACT_LIMIT,
  cleanMemoryInput,
  cleanMemoryText,
  isMemoryCategory,
  isValidDocId,
  memoryTextChange,
  newMemoryFactData,
  parseMemoryFact,
  sortMemoryFacts,
  type MemoryCategory,
  type MemoryFact,
} from '../../netlify/functions/_shared/assistant-memory-model';

export type { MemoryCategory, MemoryFact };
export {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_LABELS,
  MEMORY_FACT_LIMIT,
  MEMORY_TEXT_MAX,
  MEMORY_TEXT_MIN,
} from '../../netlify/functions/_shared/assistant-memory-model';

const loadFirestore = async () => {
  const [fs, { db }] = await Promise.all([import('firebase/firestore'), import('../firestore')]);
  return { fs, db };
};

const requireUid = (uid: unknown): string => {
  if (!isValidDocId(uid)) throw new Error('memory_id_invalid');
  return uid;
};

const requireId = (id: unknown): string => {
  if (!isValidDocId(id)) throw new Error('memory_id_invalid');
  return id;
};

/**
 * Every fact the farmer has, newest first (switched-off ones included, so the
 * screen can show them dimmed). A document that is not shaped like a fact is
 * skipped. At most 200 are read.
 */
export const listFacts = async (uid: string): Promise<MemoryFact[]> => {
  const owner = requireUid(uid);
  const { fs, db } = await loadFirestore();
  const snapshot = await fs.getDocs(
    fs.query(fs.collection(db, 'users', owner, 'assistant_memory'), fs.limit(MEMORY_FACT_LIMIT))
  );
  const facts: MemoryFact[] = [];
  snapshot.docs.forEach((entry) => {
    const fact = parseMemoryFact(entry.id, entry.data());
    if (fact) facts.push(fact);
  });
  return sortMemoryFacts(facts);
};

/**
 * Save a new fact the farmer said. Returns its id. Refused when the text is not
 * 3-200 characters, the category is unknown, or the farmer already keeps 200.
 */
export const addFact = async (uid: string, text: string, category: MemoryCategory): Promise<string> => {
  const owner = requireUid(uid);
  const input = cleanMemoryInput({ text, category });
  if (!input) throw new Error(cleanMemoryText(text) ? 'memory_category_invalid' : 'memory_text_invalid');
  const { fs, db } = await loadFirestore();
  const col = fs.collection(db, 'users', owner, 'assistant_memory');
  // Count what is there first; the rules do not count, so this is the only guard.
  const existing = await fs.getDocs(fs.query(col, fs.limit(MEMORY_FACT_LIMIT)));
  if (existing.size >= MEMORY_FACT_LIMIT) throw new Error('memory_full');
  const ref = fs.doc(col);
  await fs.setDoc(ref, newMemoryFactData(input, fs.serverTimestamp()));
  return ref.id;
};

/** Change the words of a fact. The fact is then marked as edited by the farmer. */
export const updateFact = async (uid: string, id: string, text: string): Promise<void> => {
  const owner = requireUid(uid);
  const factId = requireId(id);
  const clean = cleanMemoryText(text);
  if (!clean) throw new Error('memory_text_invalid');
  const { fs, db } = await loadFirestore();
  await fs.updateDoc(fs.doc(db, 'users', owner, 'assistant_memory', factId), memoryTextChange(clean, fs.serverTimestamp()));
};

/** Switch a fact off: it stays in the list but the assistant stops using it. */
export const deactivateFact = async (uid: string, id: string): Promise<void> => {
  const owner = requireUid(uid);
  const factId = requireId(id);
  const { fs, db } = await loadFirestore();
  await fs.updateDoc(fs.doc(db, 'users', owner, 'assistant_memory', factId), {
    active: false,
    updatedAt: fs.serverTimestamp(),
  });
};

/** Delete a fact for good. */
export const deleteFact = async (uid: string, id: string): Promise<void> => {
  const owner = requireUid(uid);
  const factId = requireId(id);
  const { fs, db } = await loadFirestore();
  await fs.deleteDoc(fs.doc(db, 'users', owner, 'assistant_memory', factId));
};

/** True for a value that may be used as a fact category. */
export const isFactCategory = isMemoryCategory;
