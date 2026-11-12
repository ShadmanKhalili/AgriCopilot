import { describe, expect, it } from 'vitest';
import {
  addDaysToDateString,
  dhakaDateString,
  isTaskDue,
  sortTasksForHome,
} from '../utils/farmTaskDates';

const task = (id: string, dueDate: string, status: 'open' | 'done' = 'open') => ({ id, dueDate, status });

describe('dhakaDateString', () => {
  it('uses the Dhaka calendar day (UTC+6)', () => {
    expect(dhakaDateString(new Date('2026-03-10T17:59:00Z'))).toBe('2026-03-10');
    expect(dhakaDateString(new Date('2026-03-10T18:00:00Z'))).toBe('2026-03-11');
  });
});

describe('addDaysToDateString', () => {
  it('adds days across month and year ends', () => {
    expect(addDaysToDateString('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateString('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('handles zero and negative days', () => {
    expect(addDaysToDateString('2026-03-01', 0)).toBe('2026-03-01');
    expect(addDaysToDateString('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('isTaskDue', () => {
  it('is due when open and due today or earlier', () => {
    expect(isTaskDue(task('a', '2026-03-10'), '2026-03-10')).toBe(true);
    expect(isTaskDue(task('a', '2026-03-09'), '2026-03-10')).toBe(true);
    expect(isTaskDue(task('a', '2026-03-11'), '2026-03-10')).toBe(false);
  });
  it('is never due once done', () => {
    expect(isTaskDue(task('a', '2026-03-01', 'done'), '2026-03-10')).toBe(false);
  });
});

describe('sortTasksForHome', () => {
  it('drops done tasks and puts due/overdue before upcoming, by date', () => {
    const out = sortTasksForHome(
      [
        task('later', '2026-03-20'),
        task('done', '2026-03-01', 'done'),
        task('soon', '2026-03-12'),
        task('old', '2026-03-05'),
        task('today', '2026-03-10'),
      ],
      '2026-03-10',
    );
    expect(out.map((t) => t.id)).toEqual(['old', 'today', 'soon', 'later']);
  });
});
