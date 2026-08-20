import { type ProgressData, progressDataSchema } from '@gloaming/shared/api/progress';

import { apiRequest, formatApiError } from '@/lib/api-request';

export const progressQueryKey = {
  all: ['progress'] as const,
  snapshot: ['progress', 'snapshot'] as const,
};

export async function getProgress(init?: { signal?: AbortSignal }): Promise<ProgressData> {
  return apiRequest('/api/progress', {
    schema: progressDataSchema,
    signal: init?.signal,
  });
}

export const formatProgressApiError = formatApiError;
