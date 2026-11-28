import { describe, expect, it } from 'vitest';
import {
  OVERDUE_WINDOW_DAYS,
  countTasksByOwner,
  daysBefore,
  taskReminderMessage,
  taskReminderQuery,
} from './task-reminders';

const row = (uid: string, id: string, dueDate: string) => ({
  document: { name: `projects/p/databases/d/documents/users/${uid}/tasks/${id}`, fields: { dueDate: { stringValue: dueDate } } },
});

describe('daysBefore', () => {
  it('goes back across month ends', () => {
    expect(daysBefore('2026-03-02', 3)).toBe('2026-02-27');
  });
});

describe('taskReminderQuery', () => {
  it('asks for open tasks due from the window start up to today', () => {
    const q = taskReminderQuery('2026-11-28', 100);
    const filters = q.where.compositeFilter.filters.map((f) => [
      f.fieldFilter.field.fieldPath,
      f.fieldFilter.op,
      f.fieldFilter.value.stringValue,
    ]);
    expect(filters).toContainEqual(['status', 'EQUAL', 'open']);
    expect(filters).toContainEqual(['dueDate', 'GREATER_THAN_OR_EQUAL', daysBefore('2026-11-28', OVERDUE_WINDOW_DAYS)]);
    expect(filters).toContainEqual(['dueDate', 'LESS_THAN_OR_EQUAL', '2026-11-28']);
    expect(q.limit).toBe(100);
  });
});

describe('countTasksByOwner', () => {
  it('counts due-today and overdue tasks per farmer', () => {
    const owners = countTasksByOwner(
      [row('u1', 'a', '2026-11-28'), row('u1', 'b', '2026-11-25'), row('u2', 'c', '2026-11-20')],
      '2026-11-28'
    );
    expect(owners.get('u1')).toEqual({ due: 1, overdue: 1 });
    expect(owners.get('u2')).toEqual({ due: 0, overdue: 1 });
  });

  it('skips future tasks, rows without a date and rows that are not tasks', () => {
    const owners = countTasksByOwner(
      [
        row('u1', 'a', '2026-12-01'),
        { document: { name: 'projects/p/databases/d/documents/users/u1/tasks/b', fields: {} } },
        { document: { name: 'projects/p/databases/d/documents/other/x' } },
        {},
      ],
      '2026-11-28'
    );
    expect(owners.size).toBe(0);
  });

  it('returns nothing for a non-array answer', () => {
    expect(countTasksByOwner({ error: 'x' }, '2026-11-28').size).toBe(0);
  });
});

describe('taskReminderMessage', () => {
  it('keeps the old wording when nothing is overdue', () => {
    const m = taskReminderMessage({ due: 2, overdue: 0 }, '2026-11-28');
    expect(m.titleEn).toBe('You have 2 farm tasks today');
    expect(m.titleBn).toContain('২টি');
  });

  it('names overdue tasks when only overdue ones exist', () => {
    const m = taskReminderMessage({ due: 0, overdue: 1 }, '2026-11-28');
    expect(m.titleEn).toBe('You have 1 overdue farm task');
    expect(m.titleBn).toContain('বকেয়া');
  });

  it('mentions both, and uses one tag per day so it never repeats within a day', () => {
    const m = taskReminderMessage({ due: 1, overdue: 3 }, '2026-11-28');
    expect(m.titleEn).toBe('1 farm task today and 3 overdue');
    expect(m.titleBn).toContain('৩টি');
    expect(m.tag).toBe('daily-tasks-2026-11-28');
  });
});
