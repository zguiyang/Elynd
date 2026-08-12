import { zValidator } from '@hono/zod-validator';
import type { Context, ValidationTargets } from 'hono';
import type { ZodType } from 'zod';

import {
  adminArticleListQuerySchema,
  createArticleBodySchema,
  libraryArticleListQuerySchema,
  updateArticleBodySchema,
} from '@elynd/shared/api/articles';

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

export const validateCreateArticle = validated('json', createArticleBodySchema);
export const validateUpdateArticle = validated('json', updateArticleBodySchema);
export const validateAdminArticleListQuery = validated('query', adminArticleListQuerySchema);
export const validateLibraryArticleListQuery = validated('query', libraryArticleListQuerySchema);
