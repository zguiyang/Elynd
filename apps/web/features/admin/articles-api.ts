import { type AdminArticleListQuery, type CreateArticleBody, type UpdateArticleBody } from '@elynd/shared/api/articles';

import {
  articleDataSchema,
  articleListDataSchema,
  type ArticleView,
  formatArticlesApiError,
  normalizeArticle,
  requestArticlesJson,
} from '@/features/articles-http';

export type AdminArticle = ArticleView;

export const adminArticlesQueryKey = {
  all: ['admin-articles'] as const,
  list: (status?: AdminArticleListQuery['status']) => [...adminArticlesQueryKey.all, 'list', status ?? 'all'] as const,
  detail: (id: string) => [...adminArticlesQueryKey.all, 'detail', id] as const,
};

export async function listAdminArticles(
  status?: AdminArticleListQuery['status'],
  init?: { signal?: AbortSignal },
): Promise<AdminArticle[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const body = await requestArticlesJson(`/api/admin/articles${qs}`, articleListDataSchema, {
    signal: init?.signal,
  });
  return body.data.items.map(normalizeArticle);
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
