import { z } from 'zod';

export const REVIEW_TIME_ZONE = 'Asia/Shanghai';
export const REVIEW_DAILY_CAP = 10 as const;

export const REVIEW_ITEM_KINDS = ['cloze', 'sense'] as const;
export type ReviewItemKind = (typeof REVIEW_ITEM_KINDS)[number];

export const REVIEW_QUEUE_STATUSES = ['need_completion', 'empty', 'ready', 'done'] as const;
export type ReviewQueueStatus = (typeof REVIEW_QUEUE_STATUSES)[number];

export const REVIEW_SESSION_SOURCES = ['cron', 'manual'] as const;
export type ReviewSessionSource = (typeof REVIEW_SESSION_SOURCES)[number];

export const REVIEW_SESSION_OUTCOMES = ['in_progress', 'completed', 'left'] as const;
export type ReviewSessionOutcome = (typeof REVIEW_SESSION_OUTCOMES)[number];

export const REVIEW_ITEMS_MAX = 10 as const;
export const REVIEW_OPTIONS_MIN = 2 as const;
export const REVIEW_OPTIONS_MAX = 4 as const;
export const REVIEW_SENTENCE_MAX = 500 as const;
export const REVIEW_FOCUS_MAX = 80 as const;
export const REVIEW_HINT_MAX = 200 as const;
/** Sense glosses are often longer than a single word; match practice option budget. */
export const REVIEW_OPTION_MAX = 200 as const;

const optionSchema = z.string().trim().min(1).max(REVIEW_OPTION_MAX);
const optionsSchema = z.array(optionSchema).min(REVIEW_OPTIONS_MIN).max(REVIEW_OPTIONS_MAX);

export function calendarDateInTimeZone(now = new Date(), timeZone = REVIEW_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export const reviewItemWriteSchema = z
  .object({
    kind: z.enum(REVIEW_ITEM_KINDS),
    sentence: z.string().trim().min(1).max(REVIEW_SENTENCE_MAX),
    focus: z.string().trim().min(1).max(REVIEW_FOCUS_MAX),
    options: optionsSchema,
    hintZh: z.string().trim().min(1).max(REVIEW_HINT_MAX),
    correctOptionIndex: z.number().int().min(0),
    sortOrder: z.number().int().min(1).max(REVIEW_ITEMS_MAX).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.correctOptionIndex >= value.options.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctOptionIndex'],
        message: 'correctOptionIndex must be a valid options index',
      });
    }
  });

export type ReviewItemWrite = z.infer<typeof reviewItemWriteSchema>;

export const replaceReviewItemsBodySchema = z.object({
  items: z.array(reviewItemWriteSchema).max(REVIEW_ITEMS_MAX),
});

export type ReplaceReviewItemsBody = z.infer<typeof replaceReviewItemsBodySchema>;

export const adminReviewItemSchema = reviewItemWriteSchema.safeExtend({
  id: z.string(),
  sortOrder: z.number().int().min(1),
});

export type AdminReviewItem = z.infer<typeof adminReviewItemSchema>;

export const adminReviewItemsDataSchema = z.object({
  items: z.array(adminReviewItemSchema),
});

export type AdminReviewItemsData = z.infer<typeof adminReviewItemsDataSchema>;

export const generateReviewItemsBodySchema = z.object({});

export type GenerateReviewItemsBody = z.infer<typeof generateReviewItemsBodySchema>;

export const generateReviewItemsResponseSchema = z.object({
  items: z.array(reviewItemWriteSchema).min(1).max(REVIEW_ITEMS_MAX),
});

export type GenerateReviewItemsResponse = z.infer<typeof generateReviewItemsResponseSchema>;

export const learnerReviewQueueItemSchema = z.object({
  id: z.string(),
  kind: z.enum(REVIEW_ITEM_KINDS),
  sentence: z.string(),
  focus: z.string(),
  options: z.array(z.string()),
  hintZh: z.string(),
  articleId: z.string(),
  articleTitle: z.string(),
  paragraphs: z.array(z.string()),
  selectedIndex: z.number().int().min(0).nullable(),
});

export type LearnerReviewQueueItem = z.infer<typeof learnerReviewQueueItemSchema>;

export const reviewTodayDataSchema = z.object({
  queueStatus: z.enum(REVIEW_QUEUE_STATUSES),
  date: z.string().min(1),
  outcome: z.enum(REVIEW_SESSION_OUTCOMES).nullable(),
  items: z.array(learnerReviewQueueItemSchema),
});

export type ReviewTodayData = z.infer<typeof reviewTodayDataSchema>;

export const reviewAnswerBodySchema = z.object({
  itemId: z.string().min(1),
  selectedIndex: z.number().int().min(0),
});

export type ReviewAnswerBody = z.infer<typeof reviewAnswerBodySchema>;

export const reviewAnswerResponseSchema = z.object({
  isHit: z.boolean(),
  hint: z.string().nullable(),
  correctIndex: z.number().int().min(0),
  queueStatus: z.enum(REVIEW_QUEUE_STATUSES),
});

export type ReviewAnswerResponse = z.infer<typeof reviewAnswerResponseSchema>;

export const reviewLeaveResponseSchema = z.object({
  queueStatus: z.literal('done'),
});

export type ReviewLeaveResponse = z.infer<typeof reviewLeaveResponseSchema>;

export const enqueueReviewMaterializeResponseSchema = z.object({
  id: z.string().min(1),
});

export type EnqueueReviewMaterializeResponse = z.infer<typeof enqueueReviewMaterializeResponseSchema>;
