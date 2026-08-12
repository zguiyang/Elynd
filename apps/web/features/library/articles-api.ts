import {
  articleDataSchema,
  articleListDataSchema,
  type ArticleView,
  formatArticlesApiError,
  normalizeArticle,
  requestArticlesJson,
} from '@/features/articles-http';

export type LibraryArticle = ArticleView;

export const libraryArticlesQueryKey = {
  all: ['library-articles'] as const,
  list: () => [...libraryArticlesQueryKey.all, 'list'] as const,
  detail: (id: string) => [...libraryArticlesQueryKey.all, 'detail', id] as const,
};

export async function listPublishedArticles(init?: { signal?: AbortSignal }): Promise<LibraryArticle[]> {
  const body = await requestArticlesJson('/api/articles', articleListDataSchema, { signal: init?.signal });
  return body.data.items.map(normalizeArticle);
}

export async function getPublishedArticle(id: string, init?: { signal?: AbortSignal }): Promise<LibraryArticle> {
  const body = await requestArticlesJson(`/api/articles/${encodeURIComponent(id)}`, articleDataSchema, {
    signal: init?.signal,
  });
  return normalizeArticle(body.data);
}

export const formatLibraryApiError = formatArticlesApiError;
