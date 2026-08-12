import { type AdminArticleListQuery, type CreateArticleBody, type UpdateArticleBody } from '@elynd/shared/api/articles';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, type PaginationMeta } from '@elynd/shared/api/pagination';

import {
  adminArticleListResponseSchema,
  articleDataSchema,
  type ArticleView,
  formatArticlesApiError,
  normalizeArticle,
  requestArticlesJson,
} from '@/features/articles-http';

export type AdminArticle = ArticleView;

export type AdminListResult = {
  items: AdminArticle[];
  pagination: PaginationMeta;
};

export type AdminListParams = Partial<AdminArticleListQuery>;

export const adminArticlesQueryKey = {
  all: ['admin-articles'] as const,
  list: (params: AdminListParams) => [...adminArticlesQueryKey.all, 'list', params] as const,
  detail: (id: string) => [...adminArticlesQueryKey.all, 'detail', id] as const,
};

function buildAdminListQuery(params: AdminListParams): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? DEFAULT_PAGE));
  search.set('pageSize', String(params.pageSize ?? DEFAULT_PAGE_SIZE));
  if (params.sortBy) {
    search.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    search.set('sortOrder', params.sortOrder);
  }
  if (params.status) {
    search.set('status', params.status);
  }
  return search.toString();
}

export async function listAdminArticles(
  params: AdminListParams = {},
  init?: { signal?: AbortSignal },
): Promise<AdminListResult> {
  const qs = buildAdminListQuery(params);
  const body = await requestArticlesJson(`/api/admin/articles?${qs}`, adminArticleListResponseSchema, {
    signal: init?.signal,
  });
  return {
    items: body.data.items.map(normalizeArticle),
    pagination: body.data.pagination,
  };
}

export async function getAdminArticle(id: string, init?: { signal?: AbortSignal }): Promise<AdminArticle> {
  const body = await requestArticlesJson(`/api/admin/articles/${encodeURIComponent(id)}`, articleDataSchema, {
    signal: init?.signal,
  });
  return normalizeArticle(body.data);
}

export async function createAdminArticle(input: CreateArticleBody): Promise<AdminArticle> {
  const body = await requestArticlesJson(`/api/admin/articles`, articleDataSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return normalizeArticle(body.data);
}

export async function updateAdminArticle(id: string, input: UpdateArticleBody): Promise<AdminArticle> {
  const body = await requestArticlesJson(`/api/admin/articles/${encodeURIComponent(id)}`, articleDataSchema, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return normalizeArticle(body.data);
}

export async function publishAdminArticle(id: string): Promise<AdminArticle> {
  const body = await requestArticlesJson(`/api/admin/articles/${encodeURIComponent(id)}/publish`, articleDataSchema, {
    method: 'POST',
  });
  return normalizeArticle(body.data);
}

export async function unpublishAdminArticle(id: string): Promise<AdminArticle> {
  const body = await requestArticlesJson(`/api/admin/articles/${encodeURIComponent(id)}/unpublish`, articleDataSchema, {
    method: 'POST',
  });
  return normalizeArticle(body.data);
}

export const formatAdminApiError = formatArticlesApiError;
