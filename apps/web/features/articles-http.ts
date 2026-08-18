import type { AdminArticle, Article, DerivedFreshness } from '@elynd/shared/api/articles';

/** Article view model: same fields as shared `Article`, dates as ISO strings. */
export type ArticleView = {
  id: string;
  title: string;
  body: string;
  level: Article['level'];
  themes: string[];
  sourceNote: string;
  status: Article['status'];
  seriesId: string | null;
  seriesOrder: number | null;
  estimatedMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type AdminArticleView = ArticleView & {
  derivedFreshness: DerivedFreshness;
};

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

export function normalizeArticle(raw: Article): ArticleView {
  return {
    id: raw.id,
    title: raw.title,
    body: raw.body,
    level: raw.level,
    themes: raw.themes,
    sourceNote: raw.sourceNote,
    status: raw.status,
    seriesId: raw.seriesId,
    seriesOrder: raw.seriesOrder,
    estimatedMinutes: raw.estimatedMinutes,
    createdAt: toIso(raw.createdAt),
    updatedAt: toIso(raw.updatedAt),
    publishedAt: raw.publishedAt == null ? null : toIso(raw.publishedAt),
  };
}

export function normalizeAdminArticle(raw: AdminArticle): AdminArticleView {
  return {
    ...normalizeArticle(raw),
    derivedFreshness: raw.derivedFreshness,
  };
}
