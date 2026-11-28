import type { Config } from '@netlify/functions';
import { adminFetch } from './_shared/service-account.ts';
import { pushConfigured, sendPushToUser } from './_shared/push-send.ts';
import {
  countTasksByOwner,
  taskReminderMessage,
  taskReminderQuery,
  type TaskCounts,
} from './_shared/task-reminders.ts';

/**
 * Every morning at 7:00 in Dhaka (01:00 UTC): tell each farmer who has farm
 * tasks due today or overdue (not done, up to 14 days past due). One
 * notification per farmer per day, however many tasks, so no task is mentioned
 * more than once a day.
 *
 * Tasks live in `users/{uid}/tasks/{taskId}` with `dueDate` ('YYYY-MM-DD',
 * Dhaka day), `status` ('open' | 'done') and `uid`.
 *
 * NEEDS a Firestore collection-group index on `tasks`: `status` ascending,
 * then `dueDate` ascending (declared in firestore.indexes.json; deploy it with
 * `firebase deploy --only firestore:indexes`). The query uses equality on
 * status and a date range on dueDate. Until the index exists the query fails,
 * nothing is sent, and the function ends quietly.
 *
 * Does nothing unless VAPID keys and the service account are set.
 */

/** Today in Dhaka as 'YYYY-MM-DD' (en-CA prints dates that way). */
const dhakaToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** Task rows read in one run, at most. */
const MAX_TASK_ROWS = 5000;

/** Open tasks due today or overdue, tallied per farmer. Empty on failure. */
const tasksToRemind = async (today: string): Promise<Map<string, TaskCounts>> => {
  try {
    const response = await adminFetch('/documents:runQuery', {
      method: 'POST',
      body: JSON.stringify({ structuredQuery: taskReminderQuery(today, MAX_TASK_ROWS) }),
    });
    if (!response.ok) {
      console.warn(`[push-daily] task query failed (${response.status}); is the tasks collection-group index created?`);
      return new Map();
    }
    return countTasksByOwner(await response.json(), today);
  } catch {
    console.warn('[push-daily] task query failed.');
    return new Map();
  }
};

export default async (): Promise<Response> => {
  if (!pushConfigured()) return new Response('push not configured', { status: 200 });

  const today = dhakaToday();
  const owners = await tasksToRemind(today);

  let notified = 0;
  const entries = [...owners.entries()];
  const CONCURRENCY = 5;
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const [uid, counts] = entries[next++];
      const sent = await sendPushToUser(uid, taskReminderMessage(counts, today));
      if (sent > 0) notified += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));

  console.log(`[push-daily] ${today}: ${owners.size} farmers with tasks, ${notified} notified.`);
  return new Response(`ok ${notified}`, { status: 200 });
};

/** 01:00 UTC = 07:00 in Dhaka. */
export const config: Config = { schedule: '0 1 * * *' };
