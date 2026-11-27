import type { Config } from '@netlify/functions';
import { adminFetch } from './_shared/service-account.ts';
import { pushConfigured, sendPushToUser } from './_shared/push-send.ts';

/**
 * Every morning at 7:00 in Dhaka (01:00 UTC): tell each farmer who has farm
 * tasks due today. One notification per farmer, however many tasks.
 *
 * Tasks live in `users/{uid}/tasks/{taskId}` with `dueDate` ('YYYY-MM-DD',
 * Dhaka day), `status` ('open' | 'done') and `uid`.
 *
 * NEEDS a Firestore index: a collection-group index on `tasks` for the fields
 * `status` and `dueDate` (Firestore console > Indexes > Single field >
 * Collection group exemptions, or create the composite index the error link
 * offers the first time this runs). Until it exists the query fails, nothing is
 * sent, and the function ends quietly.
 *
 * Does nothing unless VAPID keys and the service account are set.
 */

/** Today in Dhaka as 'YYYY-MM-DD' (en-CA prints dates that way). */
const dhakaToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const toBn = (value: number): string => String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

/** Task rows read in one run, at most. */
const MAX_TASK_ROWS = 5000;

/** Distinct owners of today's open tasks, with how many tasks each has. Empty on failure. */
const tasksDueToday = async (today: string): Promise<Map<string, number>> => {
  const counts = new Map<string, number>();
  try {
    const response = await adminFetch('/documents:runQuery', {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'tasks', allDescendants: true }],
          select: { fields: [{ fieldPath: 'uid' }] },
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                { fieldFilter: { field: { fieldPath: 'dueDate' }, op: 'EQUAL', value: { stringValue: today } } },
                { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'open' } } },
              ],
            },
          },
          limit: MAX_TASK_ROWS,
        },
      }),
    });
    if (!response.ok) {
      console.warn(`[push-daily] task query failed (${response.status}); is the tasks collection-group index created?`);
      return counts;
    }
    const rows: any = await response.json();
    if (!Array.isArray(rows)) return counts;
    for (const row of rows) {
      const name: unknown = row?.document?.name;
      if (typeof name !== 'string') continue;
      // .../documents/users/{uid}/tasks/{taskId}
      const match = name.match(/\/users\/([^/]+)\/tasks\/[^/]+$/);
      if (!match) continue;
      counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    }
  } catch {
    console.warn('[push-daily] task query failed.');
  }
  return counts;
};

export default async (): Promise<Response> => {
  if (!pushConfigured()) return new Response('push not configured', { status: 200 });

  const today = dhakaToday();
  const owners = await tasksDueToday(today);

  let notified = 0;
  const entries = [...owners.entries()];
  const CONCURRENCY = 5;
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const [uid, count] = entries[next++];
      const sent = await sendPushToUser(uid, {
        titleBn: `আজ আপনার ${toBn(count)}টি খামারের কাজ আছে`,
        titleEn: count === 1 ? 'You have 1 farm task today' : `You have ${count} farm tasks today`,
        bodyBn: 'কোন কাজগুলো বাকি আছে দেখতে চাপ দিন।',
        bodyEn: 'Tap to see what is left to do.',
        url: '/#home',
        tag: `daily-tasks-${today}`,
      });
      if (sent > 0) notified += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));

  console.log(`[push-daily] ${today}: ${owners.size} farmers with tasks, ${notified} notified.`);
  return new Response(`ok ${notified}`, { status: 200 });
};

/** 01:00 UTC = 07:00 in Dhaka. */
export const config: Config = { schedule: '0 1 * * *' };
