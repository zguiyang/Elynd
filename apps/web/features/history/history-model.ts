import type { ReadingHistoryData, ReadingHistoryWork } from '@gloaming/shared/api/reading-history';

export type HistoryViewModel = {
  today: string;
  portrait: {
    consecutiveDays: number;
    readingDays: number;
    completedWorks: number;
    lookedUpWords: number;
  };
  activity: Array<{ date: string; level: 1 }>;
  works: ReadingHistoryWork[];
};

export type HistoryActivityPoint = {
  date: string;
  count: number;
  level: number;
};

export function toHistoryViewModel(data: ReadingHistoryData): HistoryViewModel {
  return {
    today: data.today,
    portrait: data.portrait,
    activity: data.activity,
    works: data.works,
  };
}

/** `YYYY-MM-DD` → `2026年1月15日` */
export function formatHistoryCalendarDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) {
    return date;
  }
  return `${y}年${m}月${d}日`;
}

export const HISTORY_MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
] as const;

/** Weekday labels Sun→Sat for react-activity-calendar. */
export const HISTORY_WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** Binary activity calendar uses full intensity when a day was read. */
export const HISTORY_ACTIVITY_MAX_LEVEL = 4 as const;

const DAY_MS = 86_400_000;

function parseUtcDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function toCalendarKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function activityPoint(date: string, active: boolean): HistoryActivityPoint {
  return {
    date,
    count: active ? 1 : 0,
    level: active ? HISTORY_ACTIVITY_MAX_LEVEL : 0,
  };
}

/**
 * Year window for react-activity-calendar.
 * First/last entries set the range; omitted middle days render as empty.
 */
export function toHistoryActivityCalendarData(
  today: string,
  activity: ReadonlyArray<{ date: string }>,
): HistoryActivityPoint[] {
  const end = parseUtcDate(today);
  const startKey = toCalendarKey(new Date(end.getTime() - 364 * DAY_MS));
  const activeDates = new Set(activity.map((day) => day.date).filter((date) => date >= startKey && date <= today));

  const points = new Map<string, HistoryActivityPoint>();
  points.set(startKey, activityPoint(startKey, activeDates.has(startKey)));
  for (const date of activeDates) {
    points.set(date, activityPoint(date, true));
  }
  points.set(today, activityPoint(today, activeDates.has(today)));

  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function countHistoryActivityDays(activity: ReadonlyArray<{ date: string }>, today: string): number {
  const end = parseUtcDate(today);
  const startKey = toCalendarKey(new Date(end.getTime() - 364 * DAY_MS));
  return activity.reduce((count, day) => count + (day.date >= startKey && day.date <= today ? 1 : 0), 0);
}
