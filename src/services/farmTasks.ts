/**
 * Follow-up reminders stored per farmer at `users/{uid}/tasks/{taskId}`.
 * The document shape is fixed by the security rules; do not add fields.
 *
 * The pure helpers live in `../utils/farmTaskDates` (no Firebase) so they can
 * be tested without initialising Firestore; they are re-exported here.
 */

import { addDoc, collection, doc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firestore';
import {
  addDaysToDateString,
  dhakaDateString,
  sortTasksForHome as sortTasks,
} from '../utils/farmTaskDates';

export { addDaysToDateString, dhakaDateString, isTaskDue } from '../utils/farmTaskDates';

export interface FarmTaskDoc {
  uid: string;
  kind: 'follow_up';
  title: string;
  dueDate: string;
  status: 'open' | 'done';
  createdAt: string;
  diagnosisId?: string;
  crop?: string;
  doneAt?: string;
}

export type FarmTask = FarmTaskDoc & { id: string };

export function sortTasksForHome(tasks: FarmTask[], todayStr: string): FarmTask[] {
  return sortTasks(tasks, todayStr);
}

const tasksCol = (uid: string) => collection(db, 'users', uid, 'tasks');

export async function addFollowUpTask(
  uid: string,
  input: { title: string; inDays: number; diagnosisId?: string; crop?: string },
): Promise<string> {
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error('Task title is required');
  const data: FarmTaskDoc = {
    uid,
    kind: 'follow_up',
    title,
    dueDate: addDaysToDateString(dhakaDateString(), input.inDays),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  if (input.diagnosisId) data.diagnosisId = input.diagnosisId.slice(0, 128);
  if (input.crop) data.crop = input.crop.slice(0, 128);
  const ref = await addDoc(tasksCol(uid), data);
  return ref.id;
}

export async function listOpenTasks(uid: string): Promise<FarmTask[]> {
  // The filter on `uid` lets the security rules prove every row is the caller's own.
  const snap = await getDocs(query(tasksCol(uid), where('uid', '==', uid), where('status', '==', 'open'), limit(50)));
  const tasks = snap.docs.map((d) => ({ ...(d.data() as FarmTaskDoc), id: d.id }));
  return sortTasks(tasks, dhakaDateString());
}

export async function markTaskDone(uid: string, taskId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'tasks', taskId), {
    status: 'done',
    doneAt: new Date().toISOString(),
  });
}
