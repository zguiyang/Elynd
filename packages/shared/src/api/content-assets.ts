import { z } from 'zod';

import { ttsVoiceRoleValues, ttsWordTimingSchema } from '@gloaming/shared/api/tts';

export const CONTENT_ASSET_AUDIO_KINDS = ['audio_us', 'audio_uk'] as const;
export type ContentAssetAudioKind = (typeof CONTENT_ASSET_AUDIO_KINDS)[number];

/** Map TTS voice role to content_asset.kind. */
export function audioKindForRole(role: (typeof ttsVoiceRoleValues)[number]): ContentAssetAudioKind {
  return role === 'us' ? 'audio_us' : 'audio_uk';
}

export function roleForAudioKind(kind: ContentAssetAudioKind): (typeof ttsVoiceRoleValues)[number] {
  return kind === 'audio_us' ? 'us' : 'uk';
}

export const CONTENT_ASSET_STATUSES = ['ready', 'failed'] as const;
export type ContentAssetStatus = (typeof CONTENT_ASSET_STATUSES)[number];

/** Collapse whitespace the same way Azure synth text is built (SSOT for offsets). */
export function normalizePartAudioWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Exact string passed to TTS for a part. `textOffset` in wordTimings indexes this string.
 * Title and body are joined with `\n\n` when both are non-empty after normalize.
 */
export function buildPartAudioText(title: string, body: string): string {
  const normalizedTitle = normalizePartAudioWhitespace(title);
  const normalizedBody = normalizePartAudioWhitespace(body);
  if (!normalizedTitle) {
    return normalizedBody;
  }
  if (!normalizedBody) {
    return normalizedTitle;
  }
  return `${normalizedTitle}\n\n${normalizedBody}`;
}

/** Start index of the body segment inside `buildPartAudioText` output. */
export function partAudioBodyTextOffsetBase(title: string, body: string): number {
  const normalizedTitle = normalizePartAudioWhitespace(title);
  const normalizedBody = normalizePartAudioWhitespace(body);
  if (!normalizedTitle || !normalizedBody) {
    return 0;
  }
  return normalizedTitle.length + 2;
}

export const generatePartAudioBodySchema = z.object({
  roles: z.array(z.enum(ttsVoiceRoleValues)).min(1).max(2).optional(),
});

export type GeneratePartAudioBody = z.infer<typeof generatePartAudioBodySchema>;

export const contentAssetTrackSchema = z.object({
  role: z.enum(ttsVoiceRoleValues),
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

export type ContentAssetTrack = z.infer<typeof contentAssetTrackSchema>;

export const partAudioViewSchema = z.object({
  partId: z.string(),
  workId: z.string(),
  title: z.string(),
  currentContentHash: z.string(),
  tracks: z.object({
    us: contentAssetTrackSchema,
    uk: contentAssetTrackSchema,
  }),
});

export type PartAudioView = z.infer<typeof partAudioViewSchema>;

export const generatePartAudioRoleResultSchema = z.object({
  role: z.enum(ttsVoiceRoleValues),
  ok: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
  cached: z.boolean().nullable(),
  error: z.string().nullable(),
});

export type GeneratePartAudioRoleResult = z.infer<typeof generatePartAudioRoleResultSchema>;

export const generatePartAudioResultSchema = partAudioViewSchema.extend({
  results: z.array(generatePartAudioRoleResultSchema),
});

export type GeneratePartAudioResult = z.infer<typeof generatePartAudioResultSchema>;
