import { z } from 'zod';

import {
  adminArticleListDataSchema,
  type Article,
  articleSchema,
  libraryArticleListDataSchema,
} from '@elynd/shared/api/articles';

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

export type ArticlesApiError = {
  message: string;
  status: number;
  details?: { path: string; message: string }[];
};

export class ArticlesRequestError extends Error {
  readonly status: number;
  readonly details?: { path: string; message: string }[];

  constructor(error: ArticlesApiError) {
    super(error.message);
    this.name = 'ArticlesRequestError';
    this.status = error.status;
    this.details = error.details;
  }
}

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

export const articleDataSchema = z.object({ data: articleSchema });
export const adminArticleListResponseSchema = z.object({
  data: adminArticleListDataSchema,
});
export const libraryArticleListResponseSchema = z.object({
  data: libraryArticleListDataSchema,
});

async function readApiError(response: Response): Promise<ArticlesApiError> {
  let message = '请求失败';
  let details: ArticlesApiError['details'];
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

export async function requestArticlesJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
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
    throw new ArticlesRequestError(await readApiError(response));
  }

  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ArticlesRequestError({
      message: '响应格式无效',
      status: 502,
    });
  }
  return parsed.data;
}

export function formatArticlesApiError(error: unknown): string {
  if (error instanceof ArticlesRequestError) {
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
