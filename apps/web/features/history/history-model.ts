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

/** Fallback week-column count when measuring before paint (~1y, Sun week-start). */
export const HISTORY_CALENDAR_WEEK_COLUMNS = 53 as const;
/** Approximate weekday label column; refined by DOM measure after paint. */
export const HISTORY_CALENDAR_WEEKDAY_GUTTER_PX = 28 as const;
export const HISTORY_CALENDAR_BLOCK_MARGIN = 3 as const;
/** Smallest readable cell; below this we keep size and allow horizontal scroll. */
export const HISTORY_CALENDAR_MIN_BLOCK_SIZE = 8 as const;

/**
 * Block size so the year calendar spans the card width.
 * No upper clamp — grows with the container. Floor at min readable size
 * (narrow cards then scroll instead of becoming unreadable).
 *
 * Library width: `weeks * (blockSize + margin) - margin` (+ weekday gutter).
 */
export function fitHistoryCalendarBlockSize(
  containerWidth: number,
  weekColumns: number = HISTORY_CALENDAR_WEEK_COLUMNS,
  weekdayGutterPx: number = HISTORY_CALENDAR_WEEKDAY_GUTTER_PX,
): number {
  if (containerWidth <= 0 || weekColumns <= 0) {
    return HISTORY_CALENDAR_MIN_BLOCK_SIZE;
  }
  const margin = HISTORY_CALENDAR_BLOCK_MARGIN;
  const usable = Math.max(0, containerWidth - weekdayGutterPx);
  const block = Math.floor((usable - margin * (weekColumns - 1)) / weekColumns);
  return Math.max(HISTORY_CALENDAR_MIN_BLOCK_SIZE, block);
}

/**
 * Scale current block size so rendered calendar width matches the card.
 * Prefers filling the card (may overflow slightly → scroll) over leaving a gap.
 */
export function refineHistoryCalendarBlockSize(
  containerWidth: number,
  contentWidth: number,
  currentBlockSize: number,
): number {
  if (containerWidth <= 0 || contentWidth <= 0 || currentBlockSize <= 0) {
    return Math.max(HISTORY_CALENDAR_MIN_BLOCK_SIZE, currentBlockSize);
  }
  const ideal = currentBlockSize * (containerWidth / contentWidth);
  let next = Math.max(HISTORY_CALENDAR_MIN_BLOCK_SIZE, Math.floor(ideal));
  const predicted = contentWidth * (next / currentBlockSize);
  if (predicted < containerWidth - 1) {
    next += 1;
  }
  return Math.max(HISTORY_CALENDAR_MIN_BLOCK_SIZE, next);
}

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
