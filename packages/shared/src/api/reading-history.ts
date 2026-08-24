import { z } from 'zod';

/** Calendar day for reading activity (history heatmap). */
export const READING_DAY_TIME_ZONE = 'Asia/Shanghai';

export function calendarDateInTimeZone(now = new Date(), timeZone = READING_DAY_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const readingHistoryActivityLevelSchema = z.literal(1);
export type ReadingHistoryActivityLevel = z.infer<typeof readingHistoryActivityLevelSchema>;

export const readingHistoryActivityDaySchema = z.object({
  date: calendarDateSchema,
  level: readingHistoryActivityLevelSchema,
});

export type ReadingHistoryActivityDay = z.infer<typeof readingHistoryActivityDaySchema>;

export const readingHistoryCompletionSchema = z.object({
  date: calendarDateSchema,
  title: z.string().min(1),
  articleId: z.string().min(1),
});

export type ReadingHistoryCompletion = z.infer<typeof readingHistoryCompletionSchema>;

export const readingHistorySummarySchema = z.object({
  consecutiveDays: z.number().int().min(0),
  readingDays: z.number().int().min(0),
  completedArticles: z.number().int().min(0),
  lookedUpWords: z.number().int().min(0),
});

export type ReadingHistorySummary = z.infer<typeof readingHistorySummarySchema>;

export const readingHistoryDataSchema = z.object({
  today: calendarDateSchema,
  activity: z.array(readingHistoryActivityDaySchema),
  completions: z.array(readingHistoryCompletionSchema),
  portrait: readingHistorySummarySchema,
});

export type ReadingHistoryData = z.infer<typeof readingHistoryDataSchema>;
