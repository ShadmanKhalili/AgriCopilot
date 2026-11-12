import { describe, expect, it } from 'vitest';
import { hasCalendar, planTimeline, upcomingCalendarTasks, type CropPlan } from './cropCalendar';
import { CROP_SCHEDULES } from '../data/cropCalendars';
import { MAIN_CROPS } from '../data/mainCrops';

const paddy: CropPlan = { cropKey: 'paddy', sowingDate: '2026-01-10', completedStages: [] };

describe('hasCalendar', () => {
  it('knows every main crop', () => {
    for (const c of MAIN_CROPS) expect(hasCalendar(c.id)).toBe(true);
  });
  it('is false for unknown keys and object prototype names', () => {
    expect(hasCalendar('banana')).toBe(false);
    expect(hasCalendar('toString')).toBe(false);
  });
});

describe('planTimeline', () => {
  it('treats the sowing day as day 1', () => {
    const t = planTimeline(paddy, '2026-01-10');
    expect(t[0].dueDate).toBe('2026-01-10');
    expect(t[0].daysFromToday).toBe(0);
    expect(t[1].dueDate).toBe('2026-01-24'); // day 15
    expect(t[1].daysFromToday).toBe(14);
  });

  it('maps every stage with bilingual text', () => {
    const t = planTimeline(paddy, '2026-01-10');
    expect(t).toHaveLength(CROP_SCHEDULES.paddy.stages.length);
    expect(t[0].title.bn).toBe(CROP_SCHEDULES.paddy.stages[0].stageNameBn);
    expect(t[0].detail.en).toBe(CROP_SCHEDULES.paddy.stages[0].actionEn);
    expect(t.map((x) => x.stageIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('is negative for overdue stages', () => {
    const t = planTimeline(paddy, '2026-01-20');
    expect(t[0].daysFromToday).toBe(-10);
  });

  it('crosses month and year ends without drift', () => {
    const t = planTimeline({ ...paddy, sowingDate: '2025-12-20' }, '2025-12-20');
    expect(t[1].dueDate).toBe('2026-01-03');
    const leap = planTimeline({ ...paddy, sowingDate: '2028-02-20' }, '2028-02-20');
    expect(leap[1].dueDate).toBe('2028-03-05');
  });

  it('marks completed stages', () => {
    const t = planTimeline({ ...paddy, completedStages: [1] }, '2026-01-10');
    expect(t.map((x) => x.done)).toEqual([false, true, false, false, false]);
  });

  it('returns empty for unknown crop or invalid dates', () => {
    expect(planTimeline({ ...paddy, cropKey: 'banana' }, '2026-01-10')).toEqual([]);
    expect(planTimeline({ ...paddy, sowingDate: '' }, '2026-01-10')).toEqual([]);
    expect(planTimeline({ ...paddy, sowingDate: '2026-02-30' }, '2026-01-10')).toEqual([]);
    expect(planTimeline(paddy, 'today')).toEqual([]);
  });
});

describe('upcomingCalendarTasks', () => {
  it('returns stages due within a week', () => {
    // paddy day 15 = 01-24, day 40 = 02-18
    const r = upcomingCalendarTasks(paddy, '2026-01-18');
    expect(r.map((x) => x.stageIndex)).toEqual([1]);
  });

  it('includes recently overdue and excludes long overdue, soonest first', () => {
    const r = upcomingCalendarTasks(paddy, '2026-01-17'); // stage 0 exactly 7 days overdue, stage 1 exactly 7 ahead
    expect(r.map((x) => x.stageIndex)).toEqual([0, 1]);
    const late = upcomingCalendarTasks(paddy, '2026-01-20'); // 10 days overdue
    expect(late.map((x) => x.stageIndex)).toEqual([1]);
  });

  it('skips done stages', () => {
    const r = upcomingCalendarTasks({ ...paddy, completedStages: [0] }, '2026-01-17');
    expect(r.map((x) => x.stageIndex)).toEqual([1]);
  });

  it('respects custom windows', () => {
    expect(upcomingCalendarTasks(paddy, '2026-01-20', { overdueDays: 10 }).map((x) => x.stageIndex)).toEqual([0, 1]);
    expect(upcomingCalendarTasks(paddy, '2026-01-10', { aheadDays: 14 }).map((x) => x.stageIndex)).toEqual([0, 1]);
  });
});

describe('crop calendar data', () => {
  it('has ascending days, within the duration, for every main crop', () => {
    for (const c of MAIN_CROPS) {
      const cal = CROP_SCHEDULES[c.id];
      expect(cal, c.id).toBeDefined();
      const days = cal.stages.map((s) => s.day);
      expect([...days].sort((a, b) => a - b)).toEqual(days);
      expect(days[days.length - 1]).toBeLessThanOrEqual(cal.durationDays);
      for (const s of cal.stages) {
        expect(Boolean(s.stageNameBn && s.stageNameEn && s.actionBn && s.actionEn)).toBe(true);
      }
    }
  });
});
