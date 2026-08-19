import { describe, expect, it } from 'vitest';

import {
  activityToMap,
  addCalendarDays,
  buildHeatmapWeeks,
  clampWindow,
  completionsInWindow,
  consecutiveLearningDays,
  countLearningDaysInWindow,
  defaultCustomWindow,
  diffCalendarDays,
  inclusiveDayCount,
  PROGRESS_HEATMAP_WEEKS,
  progressAdvice,
  progressHeadline,
  relativeDateLabel,
  startOfWeekSunday,
  windowForTab,
} from '@/features/progress/progress-model';

const TODAY = '2026-08-19';

const SAMPLE_ACTIVITY = activityToMap([
  { date: TODAY, level: 1 },
  { date: '2026-08-18', level: 1 },
  { date: '2026-08-17', level: 1 },
  { date: '2026-08-16', level: 1 },
  { date: '2026-08-01', level: 1 },
]);

const SAMPLE_COMPLETIONS = [
  { date: '2026-08-18', title: 'The Hidden World of Oceans', articleId: 'a1' },
  { date: '2026-08-16', title: 'The Psychology of Habits', articleId: 'a2' },
  { date: '2026-08-11', title: 'A Warm Current', articleId: 'a3' },
  { date: '2026-08-04', title: 'The Science of Sleep', articleId: 'a4' },
  { date: '2026-07-22', title: 'Small Changes', articleId: 'a5' },
  { date: '2026-07-05', title: 'A Quiet Station', articleId: 'a6' },
];

describe('calendar date math', () => {
  it('adds and diffs YYYY-MM-DD without using the host timezone', () => {
    expect(addCalendarDays('2026-08-19', -29)).toBe('2026-07-21');
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffCalendarDays('2026-08-19', '2026-08-13')).toBe(6);
    expect(inclusiveDayCount({ from: '2026-08-13', to: '2026-08-19' })).toBe(7);
  });
});

describe('progress windows', () => {
  it('builds today, yesterday, 7-day, and 30-day ranges from Shanghai today', () => {
    expect(windowForTab('today', TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(windowForTab('yesterday', TODAY)).toEqual({ from: '2026-08-18', to: '2026-08-18' });
    expect(windowForTab('7', TODAY)).toEqual({ from: '2026-08-13', to: TODAY });
    expect(windowForTab('30', TODAY)).toEqual({ from: '2026-07-21', to: TODAY });
  });

  it('defaults custom to this month, clamped to 90 days', () => {
    expect(defaultCustomWindow(TODAY)).toEqual({ from: '2026-08-01', to: TODAY });
    expect(clampWindow({ from: '2026-01-01', to: TODAY }).from).toBe('2026-05-22');
  });
});

describe('windowed completions and copy', () => {
  it('counts five completions in the default 30-day window', () => {
    const selected = windowForTab('30', TODAY);
    const rows = completionsInWindow(SAMPLE_COMPLETIONS, selected);
    expect(rows).toHaveLength(5);
    expect(rows[0]?.title).toBe('The Hidden World of Oceans');
    expect(progressHeadline(selected, TODAY, 5)).toBe('这 30 天里，你读完了 5 篇。');
  });

  it('labels recent dates in Chinese without repeating 读完', () => {
    expect(relativeDateLabel('2026-08-19', TODAY)).toBe('今天');
    expect(relativeDateLabel('2026-08-18', TODAY)).toBe('昨天');
    expect(relativeDateLabel('2026-08-16', TODAY)).toBe('3 天前');
    expect(relativeDateLabel('2026-08-11', TODAY)).toBe('上周');
  });

  it('counts a current run of learning days without calling it a streak to keep', () => {
    expect(consecutiveLearningDays(TODAY, SAMPLE_ACTIVITY)).toBe(4);
    expect(
      progressAdvice({
        consecutiveDays: 4,
        learningDays: 12,
        completedArticles: 3,
        lookedUpWords: 8,
        reviewCount: 2,
        practiceCount: 6,
      }),
    ).toContain('断几天也没关系');
  });
});

describe('contribution heatmap', () => {
  it('builds 53 Sunday-start weeks and marks the selected date range', () => {
    expect(startOfWeekSunday('2026-08-19')).toBe('2026-08-16');
    const selected = windowForTab('30', TODAY);
    const weeks = buildHeatmapWeeks(TODAY, SAMPLE_ACTIVITY, selected);
    expect(weeks).toHaveLength(PROGRESS_HEATMAP_WEEKS);
    expect(weeks.at(-1)?.sunday).toBe('2026-08-16');
    const todayCell = weeks.at(-1)?.days[3];
    expect(todayCell).toMatchObject({ date: TODAY, future: false, isInRange: true, level: 1 });
    const beforeWindow = weeks.flatMap((week) => week.days).find((day) => day.date === '2026-06-01');
    expect(beforeWindow?.isInRange).toBe(false);
    expect(countLearningDaysInWindow(SAMPLE_ACTIVITY, selected)).toBe(5);
  });
});
