import type { ProgressActivityDay, ProgressCompletion, ProgressPortrait } from '@elynd/shared/api/progress';

export type { ProgressCompletion, ProgressPortrait };

export const PROGRESS_HEATMAP_WEEKS = 53 as const;
export const PROGRESS_CUSTOM_RANGE_MAX_DAYS = 90 as const;

export const PROGRESS_RANGE_TABS = ['today', 'yesterday', '7', '30', 'custom'] as const;
export type ProgressRangeTab = (typeof PROGRESS_RANGE_TABS)[number];
export type HeatmapLevel = 0 | 1;

export type CalendarDate = string;

export type ProgressWindow = {
  from: CalendarDate;
  to: CalendarDate;
};

export type HeatmapDay = {
  date: CalendarDate;
  level: HeatmapLevel;
  future: boolean;
  isInRange: boolean;
};

export type HeatmapWeek = {
  sunday: CalendarDate;
  monthLabel: string | null;
  days: HeatmapDay[];
};

function parseYmd(value: CalendarDate): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function calendarDateToLocalDate(date: CalendarDate): Date {
  const { y, m, d } = parseYmd(date);
  return new Date(y, m - 1, d);
}

export function localDateToCalendarDate(date: Date): CalendarDate {
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const { y, m, d } = parseYmd(date);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function diffCalendarDays(later: CalendarDate, earlier: CalendarDate): number {
  const a = parseYmd(later);
  const b = parseYmd(earlier);
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86_400_000);
}

export function inclusiveDayCount(window: ProgressWindow): number {
  return diffCalendarDays(window.to, window.from) + 1;
}

export function startOfMonth(date: CalendarDate): CalendarDate {
  return `${date.slice(0, 7)}-01`;
}

export function startOfWeekSunday(date: CalendarDate): CalendarDate {
  const { y, m, d } = parseYmd(date);
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addCalendarDays(date, -utcDay);
}

export function isDateInWindow(date: CalendarDate, window: ProgressWindow): boolean {
  return date >= window.from && date <= window.to;
}

export function clampWindow(window: ProgressWindow, maxDays = PROGRESS_CUSTOM_RANGE_MAX_DAYS): ProgressWindow {
  const from = window.from <= window.to ? window.from : window.to;
  const to = window.from <= window.to ? window.to : window.from;
  if (inclusiveDayCount({ from, to }) <= maxDays) {
    return { from, to };
  }
  return { from: addCalendarDays(to, -(maxDays - 1)), to };
}

export function windowForTab(tab: ProgressRangeTab, today: CalendarDate, custom?: ProgressWindow): ProgressWindow {
  if (tab === 'today') {
    return { from: today, to: today };
  }
  if (tab === 'yesterday') {
    const yesterday = addCalendarDays(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (tab === '7') {
    return { from: addCalendarDays(today, -6), to: today };
  }
  if (tab === '30') {
    return { from: addCalendarDays(today, -29), to: today };
  }
  return clampWindow(custom ?? { from: startOfMonth(today), to: today });
}

export function defaultCustomWindow(today: CalendarDate): ProgressWindow {
  return clampWindow({ from: startOfMonth(today), to: today });
}

export function completionsInWindow(
  completions: readonly ProgressCompletion[],
  window: ProgressWindow,
): ProgressCompletion[] {
  return completions
    .filter((row) => isDateInWindow(row.date, window))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));
}

export function progressHeadline(window: ProgressWindow, today: CalendarDate, completedCount: number): string {
  const yesterday = addCalendarDays(today, -1);
  const isSingle = window.from === window.to;
  if (completedCount === 0) {
    if (isSingle && window.from === today) {
      return '今天还没有读完的短文。';
    }
    if (isSingle && window.from === yesterday) {
      return '昨天还没有读完的短文。';
    }
    if (isSingle) {
      return '这一天还没有读完的短文。';
    }
    return `这 ${inclusiveDayCount(window)} 天里，还没有读完的短文。`;
  }
  if (isSingle && window.from === today) {
    return `今天你读完了 ${completedCount} 篇。`;
  }
  if (isSingle && window.from === yesterday) {
    return `昨天你读完了 ${completedCount} 篇。`;
  }
  if (isSingle) {
    return `这一天你读完了 ${completedCount} 篇。`;
  }
  return `这 ${inclusiveDayCount(window)} 天里，你读完了 ${completedCount} 篇。`;
}

export function formatMonthDay(date: CalendarDate): string {
  const { m, d } = parseYmd(date);
  return `${m}月${d}日`;
}

export function formatRangeCaption(window: ProgressWindow): string {
  if (window.from === window.to) {
    return formatMonthDay(window.from);
  }
  return `${formatMonthDay(window.from)} – ${formatMonthDay(window.to)}`;
}

export function relativeDateLabel(date: CalendarDate, today: CalendarDate): string {
  const diff = diffCalendarDays(today, date);
  if (diff === 0) {
    return '今天';
  }
  if (diff === 1) {
    return '昨天';
  }
  if (diff >= 7 && diff <= 13) {
    return '上周';
  }
  if (diff > 0 && diff < 30) {
    return `${diff} 天前`;
  }
  return formatMonthDay(date);
}

export function activityToMap(rows: readonly ProgressActivityDay[]): Map<CalendarDate, HeatmapLevel> {
  const activity = new Map<CalendarDate, HeatmapLevel>();
  for (const row of rows) {
    activity.set(row.date, 1);
  }
  return activity;
}

export function consecutiveLearningDays(
  today: CalendarDate,
  activity: ReadonlyMap<CalendarDate, HeatmapLevel>,
): number {
  let count = 0;
  let cursor = today;
  while ((activity.get(cursor) ?? 0) > 0) {
    count += 1;
    cursor = addCalendarDays(cursor, -1);
  }
  return count;
}

export function countLearningDaysInWindow(
  activity: ReadonlyMap<CalendarDate, HeatmapLevel>,
  window: ProgressWindow,
): number {
  let count = 0;
  let cursor = window.from;
  while (cursor <= window.to) {
    if ((activity.get(cursor) ?? 0) > 0) {
      count += 1;
    }
    cursor = addCalendarDays(cursor, 1);
  }
  return count;
}

export function progressAdvice(portrait: ProgressPortrait): string {
  return `这几天你都有回来打开。一共 ${portrait.learningDays} 天和英语待过一小会儿——读完 ${portrait.completedArticles} 篇，中间再碰了几句。断几天也没关系，下一篇还在图书馆。`;
}

export function buildHeatmapWeeks(
  today: CalendarDate,
  activity: ReadonlyMap<CalendarDate, HeatmapLevel>,
  window: ProgressWindow,
): HeatmapWeek[] {
  const thisSunday = startOfWeekSunday(today);
  const firstSunday = addCalendarDays(thisSunday, -7 * (PROGRESS_HEATMAP_WEEKS - 1));
  const weeks: HeatmapWeek[] = [];
  for (let weekIndex = 0; weekIndex < PROGRESS_HEATMAP_WEEKS; weekIndex += 1) {
    const sunday = addCalendarDays(firstSunday, weekIndex * 7);
    const previousSunday = weekIndex === 0 ? null : addCalendarDays(firstSunday, (weekIndex - 1) * 7);
    const isMonthChanged = previousSunday == null || previousSunday.slice(0, 7) !== sunday.slice(0, 7);
    const days: HeatmapDay[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addCalendarDays(sunday, offset);
      days.push({
        date,
        level: date > today ? 0 : (activity.get(date) ?? 0),
        future: date > today,
        isInRange: isDateInWindow(date, window),
      });
    }
    weeks.push({
      sunday,
      monthLabel: isMonthChanged ? `${parseYmd(sunday).m}月` : null,
      days,
    });
  }
  return weeks;
}
