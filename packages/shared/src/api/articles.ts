import { z } from 'zod';

/** Coarse reading bands for short articles. */
export const ARTICLE_LEVELS = ['easy', 'mid', 'stretch'] as const;
export type ArticleLevel = (typeof ARTICLE_LEVELS)[number];

export const ARTICLE_STATUSES = ['draft', 'published'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const ARTICLE_BODY_MAX_CHARS = 20_000 as const;
export const ARTICLE_BODY_MAX_WORDS = 300 as const;
export const ARTICLE_TITLE_MAX = 200 as const;
export const ARTICLE_SOURCE_NOTE_MAX = 500 as const;
export const ARTICLE_THEME_MAX_ITEMS = 10 as const;
export const ARTICLE_THEME_MAX_LEN = 40 as const;
export const ARTICLE_SERIES_ID_MAX = 64 as const;
export const ARTICLE_SERIES_ORDER_MAX = 999 as const;
export const ARTICLE_ESTIMATED_MINUTES_MAX = 30 as const;

/** Whitespace-split word count (aligned with admin UI paste form). */
export function countArticleWords(body: string): number {
  const parts = body.trim().split(/\s+/).filter(Boolean);
  return parts.length;
}

const themeItemSchema = z.string().trim().min(1).max(ARTICLE_THEME_MAX_LEN);

const themesSchema = z.array(themeItemSchema).max(ARTICLE_THEME_MAX_ITEMS);

const seriesIdSchema = z.string().trim().min(1).max(ARTICLE_SERIES_ID_MAX).nullable();

const seriesOrderSchema = z.number().int().min(1).max(ARTICLE_SERIES_ORDER_MAX).nullable();

const estimatedMinutesSchema = z.number().int().min(1).max(ARTICLE_ESTIMATED_MINUTES_MAX).nullable();

function refineSeriesPair(value: { seriesId?: string | null; seriesOrder?: number | null }, ctx: z.RefinementCtx) {
  if (value.seriesOrder != null && (value.seriesId === null || value.seriesId === '')) {
    ctx.addIssue({
      code: 'custom',
      path: ['seriesId'],
      message: 'seriesId is required when seriesOrder is set',
    });
  }
}

/** Public article JSON (API response). Dates are ISO strings after JSON serialization. */
export const articleSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  level: z.enum(ARTICLE_LEVELS),
  themes: z.array(z.string()),
  sourceNote: z.string(),
  status: z.enum(ARTICLE_STATUSES),
  seriesId: z.string().nullable(),
  seriesOrder: z.number().int().nullable(),
  estimatedMinutes: z.number().int().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  publishedAt: z.union([z.string(), z.date()]).nullable(),
});

export type Article = z.infer<typeof articleSchema>;

export const createArticleBodySchema = z
  .object({
    title: z.string().trim().min(1).max(ARTICLE_TITLE_MAX),
    body: z.string().max(ARTICLE_BODY_MAX_CHARS).optional().default(''),
    level: z.enum(ARTICLE_LEVELS).optional().default('easy'),
    themes: themesSchema.optional().default([]),
    sourceNote: z.string().max(ARTICLE_SOURCE_NOTE_MAX).optional().default(''),
    seriesId: seriesIdSchema.optional().default(null),
    seriesOrder: seriesOrderSchema.optional().default(null),
    estimatedMinutes: estimatedMinutesSchema.optional().default(null),
  })
  .superRefine(refineSeriesPair);

export type CreateArticleBody = z.infer<typeof createArticleBodySchema>;

export const updateArticleBodySchema = z
  .object({
    title: z.string().trim().min(1).max(ARTICLE_TITLE_MAX).optional(),
    body: z.string().max(ARTICLE_BODY_MAX_CHARS).optional(),
    level: z.enum(ARTICLE_LEVELS).optional(),
    themes: themesSchema.optional(),
    sourceNote: z.string().max(ARTICLE_SOURCE_NOTE_MAX).optional(),
    seriesId: seriesIdSchema.optional(),
    seriesOrder: seriesOrderSchema.optional(),
    estimatedMinutes: estimatedMinutesSchema.optional(),
  })
  .superRefine(refineSeriesPair);

export type UpdateArticleBody = z.infer<typeof updateArticleBodySchema>;

export const adminArticleListQuerySchema = z.object({
  status: z.enum(ARTICLE_STATUSES).optional(),
});

export type AdminArticleListQuery = z.infer<typeof adminArticleListQuerySchema>;

export type PublishArticleIssue = { path: string; message: string };

/** Extra gates for publish (draft may be incomplete). */
export function getPublishArticleIssues(article: {
  title: string;
  body: string;
  sourceNote: string;
  themes: string[];
  seriesId: string | null;
  seriesOrder: number | null;
}): PublishArticleIssue[] {
  const issues: PublishArticleIssue[] = [];

  if (!article.title.trim()) {
    issues.push({ path: 'title', message: 'title is required to publish' });
  }
  if (!article.body.trim()) {
    issues.push({ path: 'body', message: 'body is required to publish' });
  }
  if (!article.sourceNote.trim()) {
    issues.push({ path: 'sourceNote', message: 'sourceNote is required to publish' });
  }
  if (article.themes.length < 1) {
    issues.push({ path: 'themes', message: 'at least one theme is required to publish' });
  }

  const words = countArticleWords(article.body);
  if (words > ARTICLE_BODY_MAX_WORDS) {
    issues.push({
      path: 'body',
      message: `body must be at most ${ARTICLE_BODY_MAX_WORDS} words (got ${words})`,
    });
  }

  const hasSeriesId = article.seriesId != null && article.seriesId !== '';
  const hasSeriesOrder = article.seriesOrder != null;
  if (hasSeriesId !== hasSeriesOrder) {
    issues.push({
      path: hasSeriesId ? 'seriesOrder' : 'seriesId',
      message: 'seriesId and seriesOrder must both be set or both be null',
    });
  }

  return issues;
}
