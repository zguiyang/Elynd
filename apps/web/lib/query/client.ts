import { QueryClient } from '@tanstack/react-query';

import { ApiRequestError } from '@/lib/api-request';

const QUERY_RETRY_LIMIT = 3;

/** Skip retries for 4xx — 404/401/409 will not resolve by waiting. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiRequestError && error.status < 500) {
    return false;
  }
  return failureCount < QUERY_RETRY_LIMIT;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
    },
  });
}
