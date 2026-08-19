import { z } from 'zod';

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const progressActivityLevelSchema = z.literal(1);
export type ProgressActivityLevel = z.infer<typeof progressActivityLevelSchema>;

export const progressActivityDaySchema = z.object({
  date: calendarDateSchema,
  level: progressActivityLevelSchema,
});

export type ProgressActivityDay = z.infer<typeof progressActivityDaySchema>;

export const progressCompletionSchema = z.object({
  date: calendarDateSchema,
  title: z.string().min(1),
  articleId: z.string().min(1),
});

export type ProgressCompletion = z.infer<typeof progressCompletionSchema>;

export const progressPortraitSchema = z.object({
  consecutiveDays: z.number().int().min(0),
  learningDays: z.number().int().min(0),
  completedArticles: z.number().int().min(0),
  lookedUpWords: z.number().int().min(0),
  reviewCount: z.number().int().min(0),
  practiceCount: z.number().int().min(0),
});

export type ProgressPortrait = z.infer<typeof progressPortraitSchema>;

export const progressDataSchema = z.object({
  today: calendarDateSchema,
  activity: z.array(progressActivityDaySchema),
  completions: z.array(progressCompletionSchema),
  portrait: progressPortraitSchema,
});

export type ProgressData = z.infer<typeof progressDataSchema>;
