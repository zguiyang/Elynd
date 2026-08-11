import { z } from 'zod';

import { type Article, articleSchema } from '@elynd/shared/api/articles';

export type LibraryArticle = {
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

export type LibraryApiError = {
  message: string;
  status: number;
  details?: { path: string; message: string }[];
};

export class LibraryArticlesRequestError extends Error {
  readonly status: number;
  readonly details?: { path: string; message: string }[];

  constructor(error: LibraryApiError) {
    super(error.message);
    this.name = 'LibraryArticlesRequestError';
    this.status = error.status;
    this.details = error.details;
  }
}

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function normalizeArticle(raw: Article): LibraryArticle {
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

async function readApiError(response: Response): Promise<LibraryApiError> {
  let message = '请求失败';
  let details: LibraryApiError['details'];
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

  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
    signal: init?.signal,
  });

  if (!response.ok) {
    throw new LibraryArticlesRequestError(await readApiError(response));
  }

  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new LibraryArticlesRequestError({
      message: '响应格式无效',
      status: 502,
    });
  }
  return parsed.data;
}

export const libraryArticlesQueryKey = {
  all: ['library-articles'] as const,
  list: () => [...libraryArticlesQueryKey.all, 'list'] as const,
  detail: (id: string) => [...libraryArticlesQueryKey.all, 'detail', id] as const,
};

export async function listPublishedArticles(init?: { signal?: AbortSignal }): Promise<LibraryArticle[]> {
  const body = await requestJson('/api/articles', articleListDataSchema, { signal: init?.signal });
  return body.data.items.map(normalizeArticle);
}

export async function getPublishedArticle(id: string, init?: { signal?: AbortSignal }): Promise<LibraryArticle> {
  const body = await requestJson(`/api/articles/${encodeURIComponent(id)}`, articleDataSchema, {
    signal: init?.signal,
  });
  return normalizeArticle(body.data);
}

export function formatLibraryApiError(error: unknown): string {
  if (error instanceof LibraryArticlesRequestError) {
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
