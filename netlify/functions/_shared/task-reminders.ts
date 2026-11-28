/**
 * Pure helpers for the daily farm-task push (see push-daily.ts): which tasks
 * count, how they are tallied per farmer and what the notification says.
 *
 * Tasks due today AND tasks that are overdue (not done, due date already past)
 * are included. Overdue tasks stop being mentioned after OVERDUE_WINDOW_DAYS,
 * so an abandoned task does not nag for ever. The push goes out once a day per
 * farmer (one notification, same tag all day), so a task is never mentioned
 * more than once a day.
 */

/** How many days past its due date a task is still mentioned. */
export const OVERDUE_WINDOW_DAYS = 14;

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const toBn = (value: number): string => String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

/** Subtract whole days from a 'YYYY-MM-DD' string. */
export const daysBefore = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
};

/** Firestore structured query: open tasks due from (today - window) up to today. */
export const taskReminderQuery = (today: string, limit: number) => ({
  from: [{ collectionId: 'tasks', allDescendants: true }],
  select: { fields: [{ fieldPath: 'uid' }, { fieldPath: 'dueDate' }] },
  where: {
    compositeFilter: {
      op: 'AND',
      filters: [
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'open' } } },
        {
          fieldFilter: {
            field: { fieldPath: 'dueDate' },
            op: 'GREATER_THAN_OR_EQUAL',
            value: { stringValue: daysBefore(today, OVERDUE_WINDOW_DAYS) },
          },
        },
        { fieldFilter: { field: { fieldPath: 'dueDate' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: today } } },
      ],
    },
  },
  limit,
});

export interface TaskCounts {
  /** Due today. */
  due: number;
  /** Due on an earlier day and still open. */
  overdue: number;
}

/** Tally query rows per farmer. Rows that are not tasks, or are due in the future, are skipped. */
export const countTasksByOwner = (rows: unknown, today: string): Map<string, TaskCounts> => {
  const owners = new Map<string, TaskCounts>();
  if (!Array.isArray(rows)) return owners;
  for (const row of rows) {
    const name: unknown = row?.document?.name;
    if (typeof name !== 'string') continue;
    // .../documents/users/{uid}/tasks/{taskId}
    const match = name.match(/\/users\/([^/]+)\/tasks\/[^/]+$/);
    if (!match) continue;
    const dueDate: unknown = row?.document?.fields?.dueDate?.stringValue;
    if (typeof dueDate !== 'string' || dueDate > today) continue;
    const counts = owners.get(match[1]) ?? { due: 0, overdue: 0 };
    if (dueDate === today) counts.due += 1;
    else counts.overdue += 1;
    owners.set(match[1], counts);
  }
  return owners;
};

/** The notification for one farmer. `counts` must have at least one task. */
export const taskReminderMessage = (counts: TaskCounts, today: string) => {
  const { due, overdue } = counts;
  let titleBn: string;
  let titleEn: string;
  if (overdue === 0) {
    titleBn = `আজ আপনার ${toBn(due)}টি খামারের কাজ আছে`;
    titleEn = due === 1 ? 'You have 1 farm task today' : `You have ${due} farm tasks today`;
  } else if (due === 0) {
    titleBn = `আপনার ${toBn(overdue)}টি বকেয়া কাজ আছে`;
    titleEn = overdue === 1 ? 'You have 1 overdue farm task' : `You have ${overdue} overdue farm tasks`;
  } else {
    titleBn = `আজ ${toBn(due)}টি ও বকেয়া ${toBn(overdue)}টি খামারের কাজ আছে`;
    titleEn = `${due} farm task${due === 1 ? '' : 's'} today and ${overdue} overdue`;
  }
  return {
    titleBn,
    titleEn,
    bodyBn: 'কোন কাজগুলো বাকি আছে দেখতে চাপ দিন।',
    bodyEn: 'Tap to see what is left to do.',
    url: '/#home',
    // Same tag all day: a second push the same day replaces the first.
    tag: `daily-tasks-${today}`,
  };
};
