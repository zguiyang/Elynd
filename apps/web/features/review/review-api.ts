import {
  type ReviewAnswerResponse,
  reviewAnswerResponseSchema,
  type ReviewLeaveResponse,
  reviewLeaveResponseSchema,
  type ReviewTodayData,
  reviewTodayDataSchema,
} from '@elynd/shared/api/review';

import { apiRequest, formatApiError } from '@/lib/api-request';

export const reviewQueryKey = {
  all: ['review'] as const,
  today: ['review', 'today'] as const,
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

export const formatReviewApiError = formatApiError;
