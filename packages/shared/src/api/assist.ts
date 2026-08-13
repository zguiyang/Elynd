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

export const assistReplySchema = z.object({
  reply: z.string().min(1),
});

export type AssistReply = z.infer<typeof assistReplySchema>;

export const assistAskDataSchema = z.object({
  reply: z.string(),
  model: z
    .object({
      label: z.string(),
    })
    .optional(),
});

export type AssistAskData = z.infer<typeof assistAskDataSchema>;
