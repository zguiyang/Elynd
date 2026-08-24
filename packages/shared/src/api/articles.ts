import { z } from 'zod';

import {
  buildPaginationMeta,
  createSortByQuerySchema,
  emptyToUndefined,
  paginationMetaSchema,
  paginationQuerySchema,
} from '@gloaming/shared/api/pagination';

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

/** Registered derived projection kinds (extend when a projection stores a source hash). */
export const DERIVED_KINDS = ['audio'] as const;
export type DerivedKind = (typeof DERIVED_KINDS)[number];

export const DERIVED_STATES = ['missing', 'fresh', 'stale'] as const;
export type DerivedState = (typeof DERIVED_STATES)[number];

export const derivedFreshnessSchema = z.object({
  audio: z.enum(DERIVED_STATES),
});

export type DerivedFreshness = z.infer<typeof derivedFreshnessSchema>;

/** Admin article JSON includes derived projection freshness for ops reminders. */
export const adminArticleSchema = articleSchema.extend({
  derivedFreshness: derivedFreshnessSchema,
});

export type AdminArticle = z.infer<typeof adminArticleSchema>;

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

/** Admin list sort fields (default: updatedAt). */
export const ADMIN_ARTICLE_SORT_FIELDS = ['updatedAt'] as const;
export type AdminArticleSortField = (typeof ADMIN_ARTICLE_SORT_FIELDS)[number];
export const DEFAULT_ADMIN_ARTICLE_SORT_BY = 'updatedAt' as const satisfies AdminArticleSortField;

/** Query for `GET /api/admin/articles` (pagination + status filter). */
export const adminArticleListQuerySchema = paginationQuerySchema.extend({
  sortBy: createSortByQuerySchema(ADMIN_ARTICLE_SORT_FIELDS, DEFAULT_ADMIN_ARTICLE_SORT_BY),
  status: z.preprocess(emptyToUndefined, z.enum(ARTICLE_STATUSES).optional()),
});

export type AdminArticleListQuery = z.infer<typeof adminArticleListQuerySchema>;

export const adminArticleListDataSchema = z.object({
  items: z.array(adminArticleSchema),
  pagination: paginationMetaSchema,
});

export type AdminArticleListData = z.infer<typeof adminArticleListDataSchema>;

/** Discover list sort fields (default: publishedAt). */
export const DISCOVER_SORT_FIELDS = ['publishedAt', 'updatedAt', 'createdAt'] as const;
export type DiscoverSortField = (typeof DISCOVER_SORT_FIELDS)[number];
export const DEFAULT_DISCOVER_SORT_BY = 'publishedAt' as const satisfies DiscoverSortField;

const discoverThemeQuerySchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(ARTICLE_THEME_MAX_LEN).optional(),
);

const discoverSearchQuerySchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(ARTICLE_TITLE_MAX).optional(),
);

/** Query for `GET /api/articles` (pagination + sort + discover filters). */
export const discoverListQuerySchema = paginationQuerySchema.extend({
  sortBy: createSortByQuerySchema(DISCOVER_SORT_FIELDS, DEFAULT_DISCOVER_SORT_BY),
  theme: discoverThemeQuerySchema,
  q: discoverSearchQuerySchema,
});

export type DiscoverListQuery = z.infer<typeof discoverListQuerySchema>;

export const discoverListDataSchema = z.object({
  items: z.array(articleSchema),
  pagination: paginationMetaSchema,
  themes: z.array(z.string()),
});

export type DiscoverListData = z.infer<typeof discoverListDataSchema>;

export { buildPaginationMeta };

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
    issues.push({ path: 'title', message: '发布前请填写标题' });
  }
  if (!article.body.trim()) {
    issues.push({ path: 'body', message: '发布前请填写正文' });
  }
  if (!article.sourceNote.trim()) {
    issues.push({ path: 'sourceNote', message: '发布前请填写来源说明' });
  }
  if (article.themes.length < 1) {
    issues.push({ path: 'themes', message: '发布前请至少添加一个主题' });
  }

  const words = countArticleWords(article.body);
  if (words > ARTICLE_BODY_MAX_WORDS) {
    issues.push({
      path: 'body',
      message: `正文最多 ${ARTICLE_BODY_MAX_WORDS} 词（当前 ${words}）`,
    });
  }

  const hasSeriesId = article.seriesId != null && article.seriesId !== '';
  const hasSeriesOrder = article.seriesOrder != null;
  if (hasSeriesId !== hasSeriesOrder) {
    issues.push({
      path: hasSeriesId ? 'seriesOrder' : 'seriesId',
      message: '系列 ID 与系列顺序需同时填写或同时留空',
    });
  }

  return issues;
}
