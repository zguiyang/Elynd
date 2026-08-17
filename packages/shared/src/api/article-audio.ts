import { z } from 'zod';

import { ttsVoiceRoleValues, ttsWordTimingSchema } from '@elynd/shared/api/tts';

export const ARTICLE_AUDIO_ROLES = ttsVoiceRoleValues;
export type ArticleAudioRole = (typeof ARTICLE_AUDIO_ROLES)[number];

export const ARTICLE_AUDIO_STATUSES = ['ready', 'failed'] as const;
export type ArticleAudioStatus = (typeof ARTICLE_AUDIO_STATUSES)[number];

/** Omit or empty → generate both US and UK. Pass one role to regenerate a single track. */
export const generateArticleAudioBodySchema = z.object({
  roles: z.array(z.enum(ttsVoiceRoleValues)).min(1).max(2).optional(),
});

export type GenerateArticleAudioBody = z.infer<typeof generateArticleAudioBodySchema>;

export const articleAudioTrackSchema = z.object({
  role: z.enum(ttsVoiceRoleValues),
  /** none = never generated for this role. */
  status: z.enum(['none', 'ready', 'failed']),
  voice: z.string().nullable(),
  contentHash: z.string().nullable(),
  contentStale: z.boolean(),
  mimeType: z.string().nullable(),
  lastError: z.string().nullable(),
  generatedAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
  audioAvailable: z.boolean(),
  expired: z.boolean(),
  audioBase64: z.string().nullable(),
  wordTimings: z.array(ttsWordTimingSchema).optional(),
});

export type ArticleAudioTrack = z.infer<typeof articleAudioTrackSchema>;

export const articleAudioViewSchema = z.object({
  articleId: z.string(),
  title: z.string(),
  currentContentHash: z.string(),
  tracks: z.object({
    us: articleAudioTrackSchema,
    uk: articleAudioTrackSchema,
  }),
});

export type ArticleAudioView = z.infer<typeof articleAudioViewSchema>;

export const generateArticleAudioRoleResultSchema = z.object({
  role: z.enum(ttsVoiceRoleValues),
  ok: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
  cached: z.boolean().nullable(),
  error: z.string().nullable(),
});

export type GenerateArticleAudioRoleResult = z.infer<typeof generateArticleAudioRoleResultSchema>;

export const generateArticleAudioResultSchema = articleAudioViewSchema.extend({
  results: z.array(generateArticleAudioRoleResultSchema),
});

export type GenerateArticleAudioResult = z.infer<typeof generateArticleAudioResultSchema>;
