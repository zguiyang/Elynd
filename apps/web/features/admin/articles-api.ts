import { z } from 'zod';

import {
  type AdminArticleListQuery,
  type Article,
  articleSchema,
  type CreateArticleBody,
  type UpdateArticleBody,
} from '@elynd/shared/api/articles';

export type AdminArticle = {
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

export type AdminApiError = {
  message: string;
  status: number;
  details?: { path: string; message: string }[];
};

export class AdminArticlesRequestError extends Error {
  readonly status: number;
  readonly details?: { path: string; message: string }[];

  constructor(error: AdminApiError) {
    super(error.message);
    this.name = 'AdminArticlesRequestError';
    this.status = error.status;
    this.details = error.details;
  }
}

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function normalizeArticle(raw: Article): AdminArticle {
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

const articleDataSchema = z.object({ data: articleSchema });
const articleListDataSchema = z.object({
  data: z.object({
    items: z.array(articleSchema),
  }),
});

async function readApiError(response: Response): Promise<AdminApiError> {
  let message = '请求失败';
  let details: AdminApiError['details'];
  try {
    const body = (await response.json()) as {
      error?: string;
      details?: { path: string; message: string }[];
    };
    if (body.error?.trim()) {
      message = body.error.trim();
    }
    if (Array.isArray(body.details)) {
      details = body.details;
    }
  } catch {
    // keep defaults
  }
  return { message, status: response.status, details };
}

async function requestJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
    signal: init?.signal,
  });

  if (!response.ok) {
    throw new AdminArticlesRequestError(await readApiError(response));
  }

  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AdminArticlesRequestError({
      message: '响应格式无效',
      status: 502,
    });
  }
  return parsed.data;
}

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
  const body = await requestJson(`/api/admin/articles${qs}`, articleListDataSchema, { signal: init?.signal });
  return body.data.items.map(normalizeArticle);
}

export async function getAdminArticle(id: string, init?: { signal?: AbortSignal }): Promise<AdminArticle> {
  const body = await requestJson(`/api/admin/articles/${encodeURIComponent(id)}`, articleDataSchema, {
    signal: init?.signal,
  });
  return normalizeArticle(body.data);
}

export async function createAdminArticle(input: CreateArticleBody): Promise<AdminArticle> {
  const body = await requestJson(`/api/admin/articles`, articleDataSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return normalizeArticle(body.data);
}

export async function updateAdminArticle(id: string, input: UpdateArticleBody): Promise<AdminArticle> {
  const body = await requestJson(`/api/admin/articles/${encodeURIComponent(id)}`, articleDataSchema, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return normalizeArticle(body.data);
}

export async function publishAdminArticle(id: string): Promise<AdminArticle> {
  const body = await requestJson(`/api/admin/articles/${encodeURIComponent(id)}/publish`, articleDataSchema, {
    method: 'POST',
  });
  return normalizeArticle(body.data);
}

export async function unpublishAdminArticle(id: string): Promise<AdminArticle> {
  const body = await requestJson(`/api/admin/articles/${encodeURIComponent(id)}/unpublish`, articleDataSchema, {
    method: 'POST',
  });
  return normalizeArticle(body.data);
}

export function formatAdminApiError(error: unknown): string {
  if (error instanceof AdminArticlesRequestError) {
    if (error.details?.length) {
      return error.details.map((d) => d.message).join('；');
    }
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return '请求失败，请稍后重试';
}
