import { z } from 'zod';

import { ARTICLE_LEVELS } from '@gloaming/shared/api/articles';
import { ttsVoiceRoleValues, ttsWordTimingSchema } from '@gloaming/shared/api/tts';

export const READING_PROGRESS_STATUSES = ['in_progress', 'completed'] as const;
export type ReadingProgressStatus = (typeof READING_PROGRESS_STATUSES)[number];

export const LEARN_CONTINUE_READING_LIMIT = 5 as const;
export const LEARN_TODAY_RECOMMENDATIONS_LIMIT = 3 as const;

/** Compact article card for Today / learn surfaces (no body). */
export const learnArticleSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  level: z.enum(ARTICLE_LEVELS),
  themes: z.array(z.string()),
  estimatedMinutes: z.number().int().nullable(),
});

export type LearnArticleSummary = z.infer<typeof learnArticleSummarySchema>;

export const readingProgressSchema = z.object({
  status: z.enum(READING_PROGRESS_STATUSES),
  progressRatio: z.number().int().min(0).max(100),
  lastReadAt: z.union([z.string(), z.date()]),
  completedAt: z.union([z.string(), z.date()]).nullable(),
});

export type ReadingProgress = z.infer<typeof readingProgressSchema>;

export const learnTodayEntrySchema = z.object({
  article: learnArticleSummarySchema,
  progress: readingProgressSchema,
});

export type LearnTodayEntry = z.infer<typeof learnTodayEntrySchema>;

export const learnTodayDataSchema = z.object({
  current: learnTodayEntrySchema.nullable(),
  continueReading: z.array(learnTodayEntrySchema),
  recommendations: z.array(learnArticleSummarySchema).max(LEARN_TODAY_RECOMMENDATIONS_LIMIT),
});

export type LearnTodayData = z.infer<typeof learnTodayDataSchema>;

/** Soft ceiling for shelf grid items (excludes `current`). */
export const LEARN_SHELF_ITEMS_LIMIT = 48 as const;

/** My shelf: continue hero + remaining progress-backed articles. */
export const learnShelfDataSchema = z.object({
  current: learnTodayEntrySchema.nullable(),
  items: z.array(learnTodayEntrySchema).max(LEARN_SHELF_ITEMS_LIMIT),
});

export type LearnShelfData = z.infer<typeof learnShelfDataSchema>;

export const learnAudioAvailabilitySchema = z.object({
  us: z.boolean(),
  uk: z.boolean(),
});

export type LearnAudioAvailability = z.infer<typeof learnAudioAvailabilitySchema>;

export const learnArticleDataSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  level: z.enum(ARTICLE_LEVELS),
  themes: z.array(z.string()),
  estimatedMinutes: z.number().int().nullable(),
  progress: readingProgressSchema,
  /** Ready tracks with Redis bytes still present. */
  audioAvailable: learnAudioAvailabilitySchema,
});

export type LearnArticleData = z.infer<typeof learnArticleDataSchema>;

export const learnArticleAudioQuerySchema = z.object({
  role: z.enum(ttsVoiceRoleValues),
});

export type LearnArticleAudioQuery = z.infer<typeof learnArticleAudioQuerySchema>;

export const learnArticleAudioTrackSchema = z.object({
  role: z.enum(ttsVoiceRoleValues),
  mimeType: z.string().min(1),
  voice: z.string().min(1),
  audioBase64: z.string().min(1),
  wordTimings: z.array(ttsWordTimingSchema),
});

export type LearnArticleAudioTrack = z.infer<typeof learnArticleAudioTrackSchema>;

export const updateReadingProgressBodySchema = z
  .object({
    progressRatio: z.number().int().min(0).max(100).optional(),
    status: z.enum(READING_PROGRESS_STATUSES).optional(),
  })
  .refine((value) => value.progressRatio !== undefined || value.status !== undefined, {
    message: 'At least one of progressRatio or status is required',
  });

export type UpdateReadingProgressBody = z.infer<typeof updateReadingProgressBodySchema>;
