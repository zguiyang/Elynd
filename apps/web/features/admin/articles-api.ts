import {
  adminArticleListDataSchema,
  type AdminArticleListQuery,
  articleSchema,
  type CreateArticleBody,
  type UpdateArticleBody,
} from '@elynd/shared/api/articles';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, type PaginationMeta } from '@elynd/shared/api/pagination';

import { type ArticleView, normalizeArticle } from '@/features/articles-http';
import { apiRequest, formatApiError } from '@/lib/api-request';

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
  const body = await apiRequest(`/api/admin/articles?${qs}`, {
    schema: adminArticleListDataSchema,
    signal: init?.signal,
  });
  return {
    items: body.items.map(normalizeArticle),
    pagination: body.pagination,
  };
}

export async function getAdminArticle(id: string, init?: { signal?: AbortSignal }): Promise<AdminArticle> {
  const article = await apiRequest(`/api/admin/articles/${encodeURIComponent(id)}`, {
    schema: articleSchema,
    signal: init?.signal,
  });
  return normalizeArticle(article);
}

export async function createAdminArticle(input: CreateArticleBody): Promise<AdminArticle> {
  const article = await apiRequest(`/api/admin/articles`, {
    method: 'POST',
    schema: articleSchema,
    json: input,
  });
  return normalizeArticle(article);
}

export async function updateAdminArticle(id: string, input: UpdateArticleBody): Promise<AdminArticle> {
  const article = await apiRequest(`/api/admin/articles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    schema: articleSchema,
    json: input,
  });
  return normalizeArticle(article);
}

export async function publishAdminArticle(id: string): Promise<AdminArticle> {
  const article = await apiRequest(`/api/admin/articles/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    schema: articleSchema,
  });
  return normalizeArticle(article);
}

export async function unpublishAdminArticle(id: string): Promise<AdminArticle> {
  const article = await apiRequest(`/api/admin/articles/${encodeURIComponent(id)}/unpublish`, {
    method: 'POST',
    schema: articleSchema,
  });
  return normalizeArticle(article);
}

export const formatAdminApiError = formatApiError;
