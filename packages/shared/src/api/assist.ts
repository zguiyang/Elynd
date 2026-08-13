import { z } from 'zod';

export const ASSIST_ACTION_IDS = ['meaning', 'simpler', 'referent', 'explain', 'qa', 'lookup'] as const;

export type AssistActionId = (typeof ASSIST_ACTION_IDS)[number];

export const assistAskBodySchema = z
  .object({
    articleId: z.string().min(1),
    actionId: z.enum(ASSIST_ACTION_IDS),
    selection: z.string().trim().min(1).max(4000),
    question: z.string().trim().max(2000).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.actionId === 'qa' && !body.question?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['question'],
        message: 'question is required for qa',
      });
    }
  });

export type AssistAskBody = z.infer<typeof assistAskBodySchema>;

/** SSE `event:` names for POST /api/assist/ask */
export const ASSIST_SSE_EVENT = {
  delta: 'delta',
  done: 'done',
  error: 'error',
} as const;

export type AssistSseEventName = (typeof ASSIST_SSE_EVENT)[keyof typeof ASSIST_SSE_EVENT];

export const assistSseDeltaSchema = z.object({
  text: z.string(),
});

export type AssistSseDelta = z.infer<typeof assistSseDeltaSchema>;

export const assistSseDoneSchema = z.object({
  reply: z.string(),
  model: z
    .object({
      label: z.string(),
    })
    .optional(),
});

export type AssistSseDone = z.infer<typeof assistSseDoneSchema>;

export const assistSseErrorSchema = z.object({
  error: z.string(),
});

export type AssistSseError = z.infer<typeof assistSseErrorSchema>;
