import type {
  ReadingHistoryActivityDay,
  ReadingHistoryData,
  ReadingHistoryWork,
} from '@gloaming/shared/api/reading-history';

export type HistoryViewModel = {
  today: string;
  portrait: {
    consecutiveDays: number;
    readingDays: number;
    completedWorks: number;
    lookedUpWords: number;
  };
  activity: ReadingHistoryActivityDay[];
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

/** Deepest heatmap cell: ≥ 15 minutes engaged. */
export const HISTORY_ACTIVITY_MAX_LEVEL = 4 as const;

const LEVEL_1_MAX_EXCLUSIVE = 5 * 60;
const LEVEL_2_MAX_EXCLUSIVE = 10 * 60;
const LEVEL_3_MAX_EXCLUSIVE = 15 * 60;

/** Map engaged seconds → calendar color level (0–4). Max depth at ≥15 minutes. */
export function engagedSecondsToActivityLevel(engagedSeconds: number): number {
  if (engagedSeconds <= 0) {
    return 0;
  }
  if (engagedSeconds < LEVEL_1_MAX_EXCLUSIVE) {
    return 1;
  }
  if (engagedSeconds < LEVEL_2_MAX_EXCLUSIVE) {
    return 2;
  }
  if (engagedSeconds < LEVEL_3_MAX_EXCLUSIVE) {
    return 3;
  }
  return HISTORY_ACTIVITY_MAX_LEVEL;
}

/** Whole minutes for tooltips (ceil so 30s still shows as 1 minute). */
export function formatEngagedMinutesLabel(engagedSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(engagedSeconds / 60));
  return `约 ${minutes} 分钟`;
}

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

function activityPoint(date: string, engagedSeconds: number): HistoryActivityPoint {
  const level = engagedSecondsToActivityLevel(engagedSeconds);
  return {
    date,
    count: Math.max(0, engagedSeconds),
    level,
  };
}

/**
 * Year window for react-activity-calendar.
 * First/last entries set the range; omitted middle days render as empty.
 */
export function toHistoryActivityCalendarData(
  today: string,
  activity: ReadonlyArray<Pick<ReadingHistoryActivityDay, 'date' | 'engagedSeconds'>>,
): HistoryActivityPoint[] {
  const end = parseUtcDate(today);
  const startKey = toCalendarKey(new Date(end.getTime() - 364 * DAY_MS));
  const byDate = new Map(
    activity
      .filter((day) => day.date >= startKey && day.date <= today && day.engagedSeconds > 0)
      .map((day) => [day.date, day.engagedSeconds] as const),
  );

  const points = new Map<string, HistoryActivityPoint>();
  points.set(startKey, activityPoint(startKey, byDate.get(startKey) ?? 0));
  for (const [date, seconds] of byDate) {
    points.set(date, activityPoint(date, seconds));
  }
  points.set(today, activityPoint(today, byDate.get(today) ?? 0));

  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function countHistoryActivityDays(
  activity: ReadonlyArray<Pick<ReadingHistoryActivityDay, 'date' | 'engagedSeconds'>>,
  today: string,
): number {
  const end = parseUtcDate(today);
  const startKey = toCalendarKey(new Date(end.getTime() - 364 * DAY_MS));
  return activity.reduce(
    (count, day) => count + (day.engagedSeconds > 0 && day.date >= startKey && day.date <= today ? 1 : 0),
    0,
  );
}
