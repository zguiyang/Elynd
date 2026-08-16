import { z } from 'zod';

import { ARTICLE_LEVELS } from '@elynd/shared/api/articles';

export const READING_PROGRESS_STATUSES = ['in_progress', 'completed'] as const;
export type ReadingProgressStatus = (typeof READING_PROGRESS_STATUSES)[number];

export const PRACTICE_ITEM_KINDS = ['comprehension', 'vocab'] as const;
export type PracticeItemKind = (typeof PRACTICE_ITEM_KINDS)[number];

export const PRACTICE_ATTEMPT_STATUSES = ['in_progress', 'completed', 'skipped'] as const;
export type PracticeAttemptStatus = (typeof PRACTICE_ATTEMPT_STATUSES)[number];

export const PRACTICE_ITEMS_MAX = 5 as const;
export const PRACTICE_OPTIONS_MIN = 2 as const;
export const PRACTICE_OPTIONS_MAX = 6 as const;
export const PRACTICE_PROMPT_MAX = 500 as const;
export const PRACTICE_OPTION_MAX = 200 as const;
export const PRACTICE_WORD_MAX = 80 as const;
export const PRACTICE_HINT_MAX = 200 as const;
export const PRACTICE_QUOTE_MAX = 400 as const;
export const LEARN_CONTINUE_READING_LIMIT = 5 as const;

/** Display label for a 0-based option index (A, B, C, …). */
export function practiceOptionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

const optionSchema = z.string().trim().min(1).max(PRACTICE_OPTION_MAX);

const optionsSchema = z.array(optionSchema).min(PRACTICE_OPTIONS_MIN).max(PRACTICE_OPTIONS_MAX);

export const comprehensionPayloadSchema = z.object({
  prompt: z.string().trim().min(1).max(PRACTICE_PROMPT_MAX),
  options: optionsSchema,
});

export const vocabPayloadSchema = z.object({
  word: z.string().trim().min(1).max(PRACTICE_WORD_MAX),
  hint: z.string().trim().min(1).max(PRACTICE_HINT_MAX),
  quote: z.string().trim().min(1).max(PRACTICE_QUOTE_MAX),
  options: optionsSchema,
});

export const practiceItemPayloadSchema = z.union([comprehensionPayloadSchema, vocabPayloadSchema]);

export type PracticeItemPayload = z.infer<typeof practiceItemPayloadSchema>;

function refineCorrectOptionIndex(
  value: { payload: { options: string[] }; correctOptionIndex: number },
  ctx: z.RefinementCtx,
) {
  if (value.correctOptionIndex < 0 || value.correctOptionIndex >= value.payload.options.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['correctOptionIndex'],
      message: 'correctOptionIndex must be a valid options index',
    });
  }
}

function refineKindPayload(value: { kind: PracticeItemKind; payload: PracticeItemPayload }, ctx: z.RefinementCtx) {
  if (value.kind === 'comprehension' && !('prompt' in value.payload)) {
    ctx.addIssue({
      code: 'custom',
      path: ['payload'],
      message: 'comprehension items require prompt + options',
    });
  }
  if (value.kind === 'vocab' && !('word' in value.payload)) {
    ctx.addIssue({
      code: 'custom',
      path: ['payload'],
      message: 'vocab items require word, hint, quote, and options',
    });
  }
}

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

export const learnActivePracticeSchema = z.object({
  articleId: z.string(),
  articleTitle: z.string(),
  attemptId: z.string(),
  currentIndex: z.number().int().min(0),
  totalItems: z.number().int().min(0),
});

export type LearnActivePractice = z.infer<typeof learnActivePracticeSchema>;

export const learnTodayDataSchema = z.object({
  current: learnTodayEntrySchema.nullable(),
  continueReading: z.array(learnTodayEntrySchema),
  activePractice: learnActivePracticeSchema.nullable(),
});

export type LearnTodayData = z.infer<typeof learnTodayDataSchema>;

export const learnArticleDataSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  level: z.enum(ARTICLE_LEVELS),
  themes: z.array(z.string()),
  estimatedMinutes: z.number().int().nullable(),
  progress: readingProgressSchema,
  practiceAvailable: z.boolean(),
});

export type LearnArticleData = z.infer<typeof learnArticleDataSchema>;

export const updateReadingProgressBodySchema = z
  .object({
    progressRatio: z.number().int().min(0).max(100).optional(),
    status: z.enum(READING_PROGRESS_STATUSES).optional(),
  })
  .refine((value) => value.progressRatio !== undefined || value.status !== undefined, {
    message: 'At least one of progressRatio or status is required',
  });

export type UpdateReadingProgressBody = z.infer<typeof updateReadingProgressBodySchema>;

/** Learner-facing practice item (no correctOptionIndex). */
export const learnerPracticeItemSchema = z.object({
  id: z.string(),
  sortOrder: z.number().int().min(1),
  kind: z.enum(PRACTICE_ITEM_KINDS),
  payload: practiceItemPayloadSchema,
});

export type LearnerPracticeItem = z.infer<typeof learnerPracticeItemSchema>;

export const practiceAttemptAnswerSchema = z.object({
  practiceItemId: z.string().min(1),
  selectedOptionIndex: z.number().int().min(0),
});

export type PracticeAttemptAnswer = z.infer<typeof practiceAttemptAnswerSchema>;

export const practiceAttemptSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  status: z.enum(PRACTICE_ATTEMPT_STATUSES),
  currentIndex: z.number().int().min(0),
  answers: z.array(practiceAttemptAnswerSchema),
  startedAt: z.union([z.string(), z.date()]),
  finishedAt: z.union([z.string(), z.date()]).nullable(),
});

export type PracticeAttempt = z.infer<typeof practiceAttemptSchema>;

/** Revealed after an attempt is completed (not while answering). */
export const practiceAttemptResultItemSchema = z.object({
  practiceItemId: z.string(),
  kind: z.enum(PRACTICE_ITEM_KINDS),
  label: z.string(),
  options: z.array(z.string()),
  selectedOptionIndex: z.number().int().min(0).nullable(),
  correctOptionIndex: z.number().int().min(0),
  isCorrect: z.boolean(),
});

export type PracticeAttemptResultItem = z.infer<typeof practiceAttemptResultItemSchema>;

export const practiceAttemptResultSchema = z.object({
  correctCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  items: z.array(practiceAttemptResultItemSchema),
});

export type PracticeAttemptResult = z.infer<typeof practiceAttemptResultSchema>;

/** Post-practice AI advice (not persisted). */
export const practiceFeedbackResponseSchema = z.object({
  advice: z.string().min(1).max(500),
});

export type PracticeFeedbackResponse = z.infer<typeof practiceFeedbackResponseSchema>;

export const updatePracticeAttemptResponseSchema = practiceAttemptSchema.extend({
  result: practiceAttemptResultSchema.optional(),
});

export type UpdatePracticeAttemptResponse = z.infer<typeof updatePracticeAttemptResponseSchema>;

export const learnPracticeDataSchema = z.object({
  articleId: z.string(),
  articleTitle: z.string(),
  items: z.array(learnerPracticeItemSchema),
  attempt: practiceAttemptSchema.nullable(),
});

export type LearnPracticeData = z.infer<typeof learnPracticeDataSchema>;

export const updatePracticeAttemptBodySchema = z
  .object({
    currentIndex: z.number().int().min(0).optional(),
    answers: z.array(practiceAttemptAnswerSchema).optional(),
    status: z.enum(PRACTICE_ATTEMPT_STATUSES).optional(),
  })
  .refine((value) => value.currentIndex !== undefined || value.answers !== undefined || value.status !== undefined, {
    message: 'At least one of currentIndex, answers, or status is required',
  });

export type UpdatePracticeAttemptBody = z.infer<typeof updatePracticeAttemptBodySchema>;

/** Admin practice item (includes answer key). */
export const adminPracticeItemSchema = learnerPracticeItemSchema.extend({
  correctOptionIndex: z.number().int().min(0),
});

export type AdminPracticeItem = z.infer<typeof adminPracticeItemSchema>;

export const adminPracticeItemsDataSchema = z.object({
  items: z.array(adminPracticeItemSchema),
});

export type AdminPracticeItemsData = z.infer<typeof adminPracticeItemsDataSchema>;

/** Write shape for admin replace / AI generate (includes answer key). */
export const practiceItemWriteSchema = z
  .object({
    kind: z.enum(PRACTICE_ITEM_KINDS),
    payload: practiceItemPayloadSchema,
    correctOptionIndex: z.number().int().min(0),
    sortOrder: z.number().int().min(1).max(PRACTICE_ITEMS_MAX).optional(),
  })
  .superRefine((value, ctx) => {
    refineKindPayload(value, ctx);
    refineCorrectOptionIndex(value, ctx);
  });

export type PracticeItemWrite = z.infer<typeof practiceItemWriteSchema>;

export const replacePracticeItemsBodySchema = z.object({
  items: z.array(practiceItemWriteSchema).max(PRACTICE_ITEMS_MAX),
});

export type ReplacePracticeItemsBody = z.infer<typeof replacePracticeItemsBodySchema>;

/** AI generate returns draft items only — does not write the database. */
export const generatePracticeItemsResponseSchema = z.object({
  items: z.array(practiceItemWriteSchema).min(1).max(PRACTICE_ITEMS_MAX),
});

export type GeneratePracticeItemsResponse = z.infer<typeof generatePracticeItemsResponseSchema>;

export const generatePracticeItemsBodySchema = z.object({
  replaceExistingHint: z.boolean().optional(),
});

export type GeneratePracticeItemsBody = z.infer<typeof generatePracticeItemsBodySchema>;
