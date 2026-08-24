import { useQuery } from '@tanstack/react-query';

import { type ShelfData, shelfDataSchema } from '@gloaming/shared/api/shelf';

import { apiRequest, formatApiError } from '@/lib/api-request';

export const shelfQueryKey = {
  all: ['shelf'] as const,
};

export async function getShelf(init?: { signal?: AbortSignal }): Promise<ShelfData> {
  return apiRequest('/api/shelf', {
    schema: shelfDataSchema,
    signal: init?.signal,
  });
}

export function useShelfQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: shelfQueryKey.all,
    queryFn: ({ signal }) => getShelf({ signal }),
    enabled: options?.enabled ?? true,
  });
}

export const formatShelfApiError = formatApiError;
