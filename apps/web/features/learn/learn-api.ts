import {
  type LearnArticleData,
  learnArticleDataSchema,
  type LearnPracticeData,
  learnPracticeDataSchema,
  type LearnTodayData,
  learnTodayDataSchema,
  type PracticeAttempt,
  practiceAttemptSchema,
  type PracticeFeedbackResponse,
  practiceFeedbackResponseSchema,
  type ReadingProgress,
  readingProgressSchema,
  type UpdatePracticeAttemptBody,
  type UpdatePracticeAttemptResponse,
  updatePracticeAttemptResponseSchema,
  type UpdateReadingProgressBody,
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
): Promise<UpdatePracticeAttemptResponse> {
  return apiRequest(
    `/api/learn/articles/${encodeURIComponent(articleId)}/practice/attempts/${encodeURIComponent(attemptId)}`,
    {
      method: 'PATCH',
      schema: updatePracticeAttemptResponseSchema,
      json: body,
    },
  );
}

export async function requestPracticeFeedback(
  articleId: string,
  attemptId: string,
  init?: { signal?: AbortSignal },
): Promise<PracticeFeedbackResponse> {
  return apiRequest(
    `/api/learn/articles/${encodeURIComponent(articleId)}/practice/attempts/${encodeURIComponent(attemptId)}/feedback`,
    {
      method: 'POST',
      schema: practiceFeedbackResponseSchema,
      signal: init?.signal,
    },
  );
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
