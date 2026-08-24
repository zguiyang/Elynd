import { useQuery } from '@tanstack/react-query';

import type { ShelfItem } from '@gloaming/shared/api/shelf';
import { type Work, workSchema } from '@gloaming/shared/api/works';

import {
  type BookDetail,
  readingStatusFromProgress,
  teaserFromDescription,
} from '@/features/book-detail/book-detail-model';
import { buildShelfItemMap } from '@/features/discover/discover-api';
import { getShelf } from '@/features/shelf/shelf-api';
import { apiRequest, formatApiError } from '@/lib/api-request';

export const bookDetailQueryKey = {
  all: ['book-detail'] as const,
  detail: (workId: string) => [...bookDetailQueryKey.all, workId] as const,
};

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return typeof value === 'string' ? value : value.toISOString();
}

export async function getPublishedWork(workId: string, init?: { signal?: AbortSignal }): Promise<Work> {
  return apiRequest(`/api/catalog/works/${encodeURIComponent(workId)}`, {
    schema: workSchema,
    signal: init?.signal,
  });
}

export function toBookDetail(work: Work, shelfItem?: ShelfItem): BookDetail {
  const shelfStatus = shelfItem ? 'on_shelf' : 'available';
  const state = shelfItem?.state;
  const progressRatio = state?.progressRatio ?? null;
  const readingStatus = state ? readingStatusFromProgress(state.status, progressRatio) : 'unread';

  return {
    id: work.id,
    title: work.title,
    description: work.description,
    tags: work.tags,
    publishedAt: toIsoString(work.publishedAt),
    sourceNote: work.sourceNote,
    teaser: teaserFromDescription(work.description, work.sourceNote),
    sourceLabel: '官方',
    shelfStatus,
    readingStatus,
    progressRatio,
    lastReadAt: state?.lastReadAt
      ? typeof state.lastReadAt === 'string'
        ? state.lastReadAt
        : state.lastReadAt.toISOString()
      : null,
    completedAt: state?.completedAt
      ? typeof state.completedAt === 'string'
        ? state.completedAt
        : state.completedAt.toISOString()
      : null,
  };
}

export async function fetchBookDetail(workId: string, init?: { signal?: AbortSignal }): Promise<BookDetail> {
  const [work, shelfData] = await Promise.all([getPublishedWork(workId, init), getShelf(init)]);
  const shelfMap = buildShelfItemMap(shelfData);
  return toBookDetail(work, shelfMap.get(workId));
}

export function useBookDetailQuery(workId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bookDetailQueryKey.detail(workId),
    queryFn: ({ signal }) => fetchBookDetail(workId, { signal }),
    enabled: options?.enabled ?? Boolean(workId),
  });
}

export const formatBookDetailApiError = formatApiError;
