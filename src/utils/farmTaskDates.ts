/** Pure date helpers and task ordering for farm follow-up tasks (no Firebase). */

export interface FarmTaskShape {
  status: 'open' | 'done';
  dueDate: string;
}

/** Today's date in Asia/Dhaka as YYYY-MM-DD. */
export function dhakaDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Add (or subtract) whole days to a YYYY-MM-DD string. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + Math.trunc(days)));
  return t.toISOString().slice(0, 10);
}

/** Open and due today or earlier. */
export function isTaskDue(task: FarmTaskShape, todayStr: string): boolean {
  return task.status === 'open' && task.dueDate <= todayStr;
}

/** Open tasks only: due/overdue first, then upcoming, each group by date. */
export function sortTasksForHome<T extends FarmTaskShape>(tasks: T[], todayStr: string): T[] {
  return tasks
    .filter((t) => t.status === 'open')
    .sort((a, b) => {
      const ad = isTaskDue(a, todayStr) ? 0 : 1;
      const bd = isTaskDue(b, todayStr) ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    });
}
