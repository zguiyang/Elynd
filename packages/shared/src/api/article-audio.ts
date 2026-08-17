import { z } from 'zod';

import { ttsVoiceRoleValues, ttsWordTimingSchema } from '@elynd/shared/api/tts';

export const ARTICLE_AUDIO_STATUSES = ['ready', 'failed'] as const;
export type ArticleAudioStatus = (typeof ARTICLE_AUDIO_STATUSES)[number];

export const generateArticleAudioBodySchema = z.object({
  role: z.enum(ttsVoiceRoleValues).optional(),
});

export type GenerateArticleAudioBody = z.infer<typeof generateArticleAudioBodySchema>;

export const articleAudioViewSchema = z.object({
  articleId: z.string(),
  title: z.string(),
  /** none = never generated; ready/failed from meta row. */
  status: z.enum(['none', 'ready', 'failed']),
  voice: z.string().nullable(),
  role: z.enum(ttsVoiceRoleValues).nullable(),
  contentHash: z.string().nullable(),
  currentContentHash: z.string(),
  contentStale: z.boolean(),
  mimeType: z.string().nullable(),
  lastError: z.string().nullable(),
  generatedAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
  /** Redis still has the blob. */
  audioAvailable: z.boolean(),
  /** Meta says ready but Redis miss. */
  expired: z.boolean(),
  audioBase64: z.string().nullable(),
  wordTimings: z.array(ttsWordTimingSchema).optional(),
});

export type ArticleAudioView = z.infer<typeof articleAudioViewSchema>;

export const generateArticleAudioResultSchema = articleAudioViewSchema.extend({
  latencyMs: z.number().int().nonnegative(),
  cached: z.boolean(),
});

export type GenerateArticleAudioResult = z.infer<typeof generateArticleAudioResultSchema>;
