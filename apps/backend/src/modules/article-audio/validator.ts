import { zValidator } from '@hono/zod-validator';
import type { Context, ValidationTargets } from 'hono';
import type { ZodType } from 'zod';

import { generateArticleAudioBodySchema } from '@gloaming/shared/api/article-audio';
import { learnArticleAudioQuerySchema } from '@gloaming/shared/api/learn';

import { sendValidationError } from '@/lib/response';

function validated<T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) {
  return zValidator(target, schema, (result, c: Context) => {
    if (!result.success) {
      return sendValidationError(
        c,
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
  });
}

export const validateGenerateArticleAudio = validated('json', generateArticleAudioBodySchema);
export const validateLearnArticleAudioQuery = validated('query', learnArticleAudioQuerySchema);
