import { z } from 'zod';

import { ttsVoiceRoleValues, ttsWordTimingSchema } from '@gloaming/shared/api/tts';
import { partSummarySchema, workSchema } from '@gloaming/shared/api/works';

export const READING_STATE_STATUSES = ['in_progress', 'completed'] as const;
export type ReadingStateStatus = (typeof READING_STATE_STATUSES)[number];

export const readingStateSchema = z.object({
  status: z.enum(READING_STATE_STATUSES),
  currentPartId: z.string().nullable(),
  /** Computed for UI — not persisted. */
  progressRatio: z.number().int().min(0).max(100),
  lastReadAt: z.union([z.string(), z.date()]),
  completedAt: z.union([z.string(), z.date()]).nullable(),
});

export type ReadingState = z.infer<typeof readingStateSchema>;

/** Compute UI progress from persisted anchor fields. */
export function computeProgressRatio(input: {
  status: ReadingStateStatus;
  anchorKind: string | null;
  anchorValue: string | null;
}): number {
  if (input.status === 'completed') {
    return 100;
  }
  if (input.anchorKind === 'percent' && input.anchorValue != null) {
    const parsed = Number.parseInt(input.anchorValue, 10);
    if (!Number.isNaN(parsed)) {
      return Math.min(100, Math.max(0, parsed));
    }
  }
  return 0;
}

export const readerWorkSummarySchema = workSchema.pick({
  id: true,
  title: true,
  description: true,
  tags: true,
  publishedAt: true,
});

export type ReaderWorkSummary = z.infer<typeof readerWorkSummarySchema>;

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

export const readerSessionDataSchema = z.object({
  work: readerWorkSummarySchema,
  parts: z.array(partSummarySchema),
  currentPart: readerCurrentPartSchema,
  state: readingStateSchema,
  audioAvailable: readerAudioAvailabilitySchema,
});

export type ReaderSessionData = z.infer<typeof readerSessionDataSchema>;

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
    progressRatio: z.number().int().min(0).max(100).optional(),
    status: z.enum(READING_STATE_STATUSES).optional(),
    currentPartId: z.string().min(1).optional(),
  })
  .refine(
    (value) => value.progressRatio !== undefined || value.status !== undefined || value.currentPartId !== undefined,
    {
      message: 'At least one of progressRatio, status, or currentPartId is required',
    },
  );

export type UpdateReadingStateBody = z.infer<typeof updateReadingStateBodySchema>;
