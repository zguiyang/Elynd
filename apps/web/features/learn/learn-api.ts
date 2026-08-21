import {
  type LearnArticleData,
  learnArticleDataSchema,
  type LearnShelfData,
  learnShelfDataSchema,
  type LearnTodayData,
  learnTodayDataSchema,
  type ReadingProgress,
  readingProgressSchema,
  type UpdateReadingProgressBody,
} from '@gloaming/shared/api/learn';

import { apiRequest, formatApiError } from '@/lib/api-request';

export const learnQueryKey = {
  all: ['learn'] as const,
  today: () => [...learnQueryKey.all, 'today'] as const,
  shelf: () => [...learnQueryKey.all, 'shelf'] as const,
  article: (articleId: string) => [...learnQueryKey.all, 'article', articleId] as const,
};

export async function getLearnToday(init?: { signal?: AbortSignal }): Promise<LearnTodayData> {
  return apiRequest('/api/learn/today', {
    schema: learnTodayDataSchema,
    signal: init?.signal,
  });
}

export async function getLearnShelf(init?: { signal?: AbortSignal }): Promise<LearnShelfData> {
  return apiRequest('/api/learn/shelf', {
    schema: learnShelfDataSchema,
    signal: init?.signal,
  });
}

export async function getLearnArticle(articleId: string, init?: { signal?: AbortSignal }): Promise<LearnArticleData> {
  return apiRequest(`/api/learn/articles/${encodeURIComponent(articleId)}`, {
    schema: learnArticleDataSchema,
    signal: init?.signal,
  });
}

export async function updateLearnReadingProgress(
  articleId: string,
  body: UpdateReadingProgressBody,
): Promise<ReadingProgress> {
  return apiRequest(`/api/learn/articles/${encodeURIComponent(articleId)}/progress`, {
    method: 'PATCH',
    json: body,
    schema: readingProgressSchema,
  });
}

export const formatLearnApiError = formatApiError;
