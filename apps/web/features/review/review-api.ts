import {
  type ReviewAnswerResponse,
  reviewAnswerResponseSchema,
  type ReviewFeedbackResponse,
  reviewFeedbackResponseSchema,
  type ReviewLeaveResponse,
  reviewLeaveResponseSchema,
  type ReviewTodayData,
  reviewTodayDataSchema,
} from '@gloaming/shared/api/review';

import { apiRequest, formatApiError } from '@/lib/api-request';

export const reviewQueryKey = {
  all: ['review'] as const,
  today: ['review', 'today'] as const,
  feedback: (date: string, resultIds: string) => ['review', 'today', 'feedback', date, resultIds] as const,
};

export async function getReviewToday(init?: { signal?: AbortSignal }): Promise<ReviewTodayData> {
  return apiRequest('/api/review/today', {
    schema: reviewTodayDataSchema,
    signal: init?.signal,
  });
}

export async function answerReviewToday(body: {
  itemId: string;
  selectedIndex: number;
}): Promise<ReviewAnswerResponse> {
  return apiRequest('/api/review/today/answers', {
    method: 'POST',
    json: body,
    schema: reviewAnswerResponseSchema,
  });
}

export async function leaveReviewToday(): Promise<ReviewLeaveResponse> {
  return apiRequest('/api/review/today/leave', {
    method: 'POST',
    schema: reviewLeaveResponseSchema,
  });
}

export async function requestReviewFeedback(init?: { signal?: AbortSignal }): Promise<ReviewFeedbackResponse> {
  return apiRequest('/api/review/today/feedback', {
    method: 'POST',
    schema: reviewFeedbackResponseSchema,
    signal: init?.signal,
  });
}

export const formatReviewApiError = formatApiError;
