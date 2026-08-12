import { libraryArticleListDataSchema, type LibraryArticleListQuery } from '@elynd/shared/api/articles';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, type PaginationMeta } from '@elynd/shared/api/pagination';

import { type ArticleView, normalizeArticle } from '@/features/articles-http';
import { apiRequest, formatApiError } from '@/lib/api-request';

export type LibraryArticle = ArticleView;

export type LibraryListResult = {
  items: LibraryArticle[];
  pagination: PaginationMeta;
  themes: string[];
};

export type LibraryListParams = Partial<LibraryArticleListQuery>;

export const libraryArticlesQueryKey = {
  all: ['library-articles'] as const,
  list: (params: LibraryListParams) => [...libraryArticlesQueryKey.all, 'list', params] as const,
};

function buildLibraryListQuery(params: LibraryListParams): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? DEFAULT_PAGE));
  search.set('pageSize', String(params.pageSize ?? DEFAULT_PAGE_SIZE));
  if (params.sortBy) {
    search.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    search.set('sortOrder', params.sortOrder);
  }
  if (params.theme) {
    search.set('theme', params.theme);
  }
  if (params.q) {
    search.set('q', params.q);
  }
  return search.toString();
}

export async function listPublishedArticles(
  params: LibraryListParams = {},
  init?: { signal?: AbortSignal },
): Promise<LibraryListResult> {
  const qs = buildLibraryListQuery(params);
  const body = await apiRequest(`/api/articles?${qs}`, {
    schema: libraryArticleListDataSchema,
    signal: init?.signal,
  });
  return {
    items: body.items.map(normalizeArticle),
    pagination: body.pagination,
    themes: body.themes,
  };
}

export const formatLibraryApiError = formatApiError;
