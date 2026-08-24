import { useQuery } from '@tanstack/react-query';

import { type Article, articleSchema, countArticleWords } from '@gloaming/shared/api/articles';
import type { ShelfItem } from '@gloaming/shared/api/shelf';

import { type BookDetail, readingStatusFromProgress, teaserFromBody } from '@/features/book-detail/book-detail-model';
import { buildShelfItemMap } from '@/features/discover/discover-api';
import { getShelf } from '@/features/shelf/shelf-api';
import { apiRequest, formatApiError } from '@/lib/api-request';

export const bookDetailQueryKey = {
  all: ['book-detail'] as const,
  detail: (articleId: string) => [...bookDetailQueryKey.all, articleId] as const,
};

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return typeof value === 'string' ? value : value.toISOString();
}

export async function getPublishedArticle(articleId: string, init?: { signal?: AbortSignal }): Promise<Article> {
  return apiRequest(`/api/articles/${encodeURIComponent(articleId)}`, {
    schema: articleSchema,
    signal: init?.signal,
  });
}

export function toBookDetail(article: Article, shelfItem?: ShelfItem): BookDetail {
  const shelfStatus = shelfItem ? 'on_shelf' : 'available';
  const progress = shelfItem?.progress;
  const progressRatio = progress?.progressRatio ?? null;
  const readingStatus = progress ? readingStatusFromProgress(progress.status, progressRatio) : 'unread';

  return {
    id: article.id,
    title: article.title,
    level: article.level,
    themes: article.themes,
    estimatedMinutes: article.estimatedMinutes,
    publishedAt: toIsoString(article.publishedAt),
    sourceNote: article.sourceNote,
    wordCount: countArticleWords(article.body),
    teaser: teaserFromBody(article.body, article.sourceNote),
    sourceLabel: '官方',
    shelfStatus,
    readingStatus,
    progressRatio,
    lastReadAt: progress?.lastReadAt
      ? typeof progress.lastReadAt === 'string'
        ? progress.lastReadAt
        : progress.lastReadAt.toISOString()
      : null,
    completedAt: progress?.completedAt
      ? typeof progress.completedAt === 'string'
        ? progress.completedAt
        : progress.completedAt.toISOString()
      : null,
  };
}

export async function fetchBookDetail(articleId: string, init?: { signal?: AbortSignal }): Promise<BookDetail> {
  const [article, shelfData] = await Promise.all([getPublishedArticle(articleId, init), getShelf(init)]);
  const shelfMap = buildShelfItemMap(shelfData);
  return toBookDetail(article, shelfMap.get(articleId));
}

export function useBookDetailQuery(articleId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bookDetailQueryKey.detail(articleId),
    queryFn: ({ signal }) => fetchBookDetail(articleId, { signal }),
    enabled: options?.enabled ?? Boolean(articleId),
  });
}

export const formatBookDetailApiError = formatApiError;
