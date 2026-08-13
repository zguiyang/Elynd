import {
  type LearnArticleData,
  learnArticleDataSchema,
  type LearnPracticeData,
  learnPracticeDataSchema,
  type LearnTodayData,
  learnTodayDataSchema,
  type PracticeAttempt,
  practiceAttemptSchema,
  type UpdatePracticeAttemptBody,
} from '@elynd/shared/api/learn';

import { apiRequest, formatApiError } from '@/lib/api-request';

export const learnQueryKey = {
  all: ['learn'] as const,
  today: () => [...learnQueryKey.all, 'today'] as const,
  article: (articleId: string) => [...learnQueryKey.all, 'article', articleId] as const,
  practice: (articleId: string) => [...learnQueryKey.all, 'practice', articleId] as const,
};

export async function getLearnToday(init?: { signal?: AbortSignal }): Promise<LearnTodayData> {
  return apiRequest('/api/learn/today', {
    schema: learnTodayDataSchema,
    signal: init?.signal,
  });
}

export async function getLearnArticle(articleId: string, init?: { signal?: AbortSignal }): Promise<LearnArticleData> {
  return apiRequest(`/api/learn/articles/${encodeURIComponent(articleId)}`, {
    schema: learnArticleDataSchema,
    signal: init?.signal,
  });
}

export async function getLearnPractice(articleId: string, init?: { signal?: AbortSignal }): Promise<LearnPracticeData> {
  return apiRequest(`/api/learn/articles/${encodeURIComponent(articleId)}/practice`, {
    schema: learnPracticeDataSchema,
    signal: init?.signal,
  });
}

export async function startLearnPracticeAttempt(articleId: string): Promise<PracticeAttempt> {
  return apiRequest(`/api/learn/articles/${encodeURIComponent(articleId)}/practice/attempts`, {
    method: 'POST',
    schema: practiceAttemptSchema,
  });
}

export async function updateLearnPracticeAttempt(
  articleId: string,
  attemptId: string,
  body: UpdatePracticeAttemptBody,
): Promise<PracticeAttempt> {
  return apiRequest(
    `/api/learn/articles/${encodeURIComponent(articleId)}/practice/attempts/${encodeURIComponent(attemptId)}`,
    {
      method: 'PATCH',
      schema: practiceAttemptSchema,
      json: body,
    },
  );
}

export const formatLearnApiError = formatApiError;
