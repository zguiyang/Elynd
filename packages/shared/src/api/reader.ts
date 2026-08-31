import { z } from 'zod';

import { ttsVoiceRoleValues, ttsWordTimingSchema } from '@gloaming/shared/api/tts';
import { partSummarySchema, workSchema } from '@gloaming/shared/api/works';

export const READING_STATE_STATUSES = ['in_progress', 'completed'] as const;
export type ReadingStateStatus = (typeof READING_STATE_STATUSES)[number];

/** No chapters fully completed yet. */
export const NO_CHAPTERS_COMPLETED = -1 as const;

export const READING_STATE_ACTIONS = [
  'open',
  'complete_chapter',
  'navigate',
  'finish',
  'restart',
  'add_to_shelf',
] as const;
export type ReadingStateAction = (typeof READING_STATE_ACTIONS)[number];

export const readingStateSchema = z.object({
  status: z.enum(READING_STATE_STATUSES),
  currentPartId: z.string().nullable(),
  completedThroughSortOrder: z.number().int(),
  /** Computed for UI — not persisted. */
  progressRatio: z.number().int().min(0).max(100),
  totalPartCount: z.number().int().nonnegative(),
  lastReadAt: z.union([z.string(), z.date()]),
  completedAt: z.union([z.string(), z.date()]).nullable(),
});

export type ReadingState = z.infer<typeof readingStateSchema>;

export type PartSortOrder = { sortOrder: number };

/** Chapter-based progress: completed parts / total parts. */
export function computeChapterProgress(input: {
  status: ReadingStateStatus;
  completedThroughSortOrder: number;
  parts: PartSortOrder[];
}): number {
  if (input.status === 'completed') {
    return 100;
  }
  const total = input.parts.length;
  if (total <= 0) {
    return 0;
  }
  if (input.completedThroughSortOrder < NO_CHAPTERS_COMPLETED) {
    return 0;
  }
  const completedCount = input.parts.filter((part) => part.sortOrder <= input.completedThroughSortOrder).length;
  return Math.round((completedCount / total) * 100);
}

export const readerWorkSummarySchema = workSchema.pick({
  id: true,
  title: true,
  description: true,
  tags: true,
  coverAssetId: true,
  publishedAt: true,
});

export type ReaderWorkSummary = z.infer<typeof readerWorkSummarySchema>;

/** DB-derived: ready asset for current part content hash — not a live R2 existence check. */
export const readerAudioAvailabilitySchema = z.object({
  us: z.boolean(),
  uk: z.boolean(),
});

export type ReaderAudioAvailability = z.infer<typeof readerAudioAvailabilitySchema>;

export const readerCurrentPartSchema = z.object({
  id: z.string(),
  workId: z.string(),
  sortOrder: z.number().int(),
  kind: partSummarySchema.shape.kind,
  title: z.string(),
  body: z.string(),
});

export type ReaderCurrentPart = z.infer<typeof readerCurrentPartSchema>;

export const readerPartsDataSchema = z.object({
  work: readerWorkSummarySchema,
  parts: z.array(partSummarySchema),
});

export type ReaderPartsData = z.infer<typeof readerPartsDataSchema>;

export const readerPartDataSchema = z.object({
  work: readerWorkSummarySchema.pick({ id: true, title: true, coverAssetId: true, tags: true }),
  part: readerCurrentPartSchema,
  audioAvailable: readerAudioAvailabilitySchema,
});

export type ReaderPartData = z.infer<typeof readerPartDataSchema>;

export const readingStateDataSchema = z.object({
  state: readingStateSchema.nullable(),
});

export type ReadingStateData = z.infer<typeof readingStateDataSchema>;

export const readerPartAudioQuerySchema = z.object({
  role: z.enum(ttsVoiceRoleValues),
});

export type ReaderPartAudioQuery = z.infer<typeof readerPartAudioQuerySchema>;

export const readerAudioTrackSchema = z.object({
  role: z.enum(ttsVoiceRoleValues),
  mimeType: z.string().min(1),
  voice: z.string().min(1),
  /** Gateway URL — `/api/assets/:assetId`. */
  audioUrl: z.string().min(1),
  assetId: z.string().min(1),
  durationMs: z.number().int().nonnegative().nullable(),
  wordTimings: z.array(ttsWordTimingSchema),
});

export type ReaderAudioTrack = z.infer<typeof readerAudioTrackSchema>;

export const updateReadingStateBodySchema = z
  .object({
    action: z.enum(READING_STATE_ACTIONS),
    partId: z.string().min(1).optional(),
    nextPartId: z.string().min(1).optional(),
  })
  .superRefine((body, ctx) => {
    if ((body.action === 'navigate' || body.action === 'open') && !body.partId) {
      if (body.action === 'navigate') {
        ctx.addIssue({
          code: 'custom',
          path: ['partId'],
          message: 'partId is required for navigate',
        });
      }
    }
    if (body.action === 'complete_chapter' && body.partId) {
      ctx.addIssue({
        code: 'custom',
        path: ['partId'],
        message: 'partId is not allowed for complete_chapter',
      });
    }
  });

export type UpdateReadingStateBody = z.infer<typeof updateReadingStateBodySchema>;

/** @deprecated Session aggregate removed — use readerPartsDataSchema + readerPartDataSchema + readingStateSchema */
export const readerSessionDataSchema = readerPartsDataSchema;
export type ReaderSessionData = ReaderPartsData;
