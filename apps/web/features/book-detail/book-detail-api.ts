/**
 * Book detail data layer — hybrid real catalog/shelf/parts + stats placeholders.
 * Reader parts fetch uses credentials: 'omit' so viewing detail does not create reading_state.
 */

import { useQuery } from '@tanstack/react-query';

import type { ReadingState } from '@gloaming/shared/api/reader';
import type { ShelfItem } from '@gloaming/shared/api/shelf';
import { type PartSummary, type Work, workSchema } from '@gloaming/shared/api/works';

import {
  type BookChapter,
  type BookDetail,
  type BookDetailLevel,
  coverUrlFromAssetId,
  languageLabelFromCode,
  readingStatusFromProgress,
  teaserFromDescription,
} from '@/features/book-detail/book-detail-model';
import { buildShelfItemMap, listCatalogWorks } from '@/features/discover/discover-api';
import { getReaderSessionData } from '@/features/reader/reader-api';
import { getShelf } from '@/features/shelf/shelf-api';
import { apiRequest, ApiRequestError, formatApiError } from '@/lib/api-request';

/** Stats bar placeholders — no domain fields yet (ADR-001). */
export const BOOK_DETAIL_STATS_PLACEHOLDER = {
  level: 'mid' as BookDetailLevel,
  cefrLabel: 'CEFR B2',
  estimatedMinutes: 450,
  wordCount: 85_000,
} as const;

const RELATED_LIMIT = 4;

export const bookDetailQueryKey = {
  all: ['book-detail'] as const,
  detail: (workId: string) => [...bookDetailQueryKey.all, workId] as const,
};

export async function getPublishedWork(workId: string, init?: { signal?: AbortSignal }): Promise<Work> {
  return apiRequest(`/api/catalog/works/${encodeURIComponent(workId)}`, {
    schema: workSchema,
    signal: init?.signal,
  });
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return typeof value === 'string' ? value : value.toISOString();
}

export function chaptersFromParts(parts: PartSummary[], state: ReadingState | null): BookChapter[] {
  const sorted = [...parts].sort((a, b) => a.sortOrder - b.sortOrder);
  const readingStatus = state ? readingStatusFromProgress(state.status, state.progressRatio) : 'unread';

  if (readingStatus === 'unread') {
    return sorted.map((part, i) => ({
      id: part.id,
      index: i + 1,
      title: part.title || `第 ${i + 1} 章`,
      estimatedMinutes: null,
      wordCount: null,
      status: 'unread' as const,
    }));
  }

  if (readingStatus === 'completed') {
    return sorted.map((part, i) => ({
      id: part.id,
      index: i + 1,
      title: part.title || `第 ${i + 1} 章`,
      estimatedMinutes: null,
      wordCount: null,
      status: 'read' as const,
    }));
  }

  const currentId = state?.currentPartId;
  const currentIndex = currentId ? sorted.findIndex((p) => p.id === currentId) : 0;
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return sorted.map((part, i) => {
    let status: BookChapter['status'] = 'unread';
    if (i < activeIndex) {
      status = 'read';
    } else if (i === activeIndex) {
      status = 'current';
    }
    return {
      id: part.id,
      index: i + 1,
      title: part.title || `第 ${i + 1} 章`,
      estimatedMinutes: null,
      wordCount: null,
      status,
    };
  });
}

function workToRelatedStub(work: Work): BookDetail {
  return {
    id: work.id,
    title: work.title,
    author: work.author,
    level: BOOK_DETAIL_STATS_PLACEHOLDER.level,
    cefrLabel: BOOK_DETAIL_STATS_PLACEHOLDER.cefrLabel,
    category: work.tags[0] ?? '读物',
    tags: work.tags,
    estimatedMinutes: BOOK_DETAIL_STATS_PLACEHOLDER.estimatedMinutes,
    wordCount: BOOK_DETAIL_STATS_PLACEHOLDER.wordCount,
    teaser: teaserFromDescription(work.description),
    sourceLabel: '官方',
    languageLabel: languageLabelFromCode(work.language),
    sourceNote: work.sourceNote,
    coverImageUrl: coverUrlFromAssetId(work.coverAssetId),
    shelfStatus: 'available',
    readingStatus: 'unread',
    progressRatio: null,
    lastReadAt: null,
    completedAt: null,
    chapters: [],
    relatedIds: [],
  };
}

export function toBookDetail(
  work: Work,
  parts: PartSummary[],
  shelfItem: ShelfItem | undefined,
  relatedWorks: Work[],
): BookDetail {
  const state = shelfItem?.state ?? null;
  const progressRatio = state?.progressRatio ?? null;
  const readingStatus = state ? readingStatusFromProgress(state.status, progressRatio) : 'unread';
  const teaser = teaserFromDescription(work.description);

  return {
    id: work.id,
    title: work.title,
    author: work.author,
    level: BOOK_DETAIL_STATS_PLACEHOLDER.level,
    cefrLabel: BOOK_DETAIL_STATS_PLACEHOLDER.cefrLabel,
    category: work.tags[0] ?? '读物',
    tags: work.tags,
    estimatedMinutes: BOOK_DETAIL_STATS_PLACEHOLDER.estimatedMinutes,
    wordCount: BOOK_DETAIL_STATS_PLACEHOLDER.wordCount,
    teaser,
    sourceLabel: '官方',
    languageLabel: languageLabelFromCode(work.language),
    sourceNote: work.sourceNote,
    coverImageUrl: coverUrlFromAssetId(work.coverAssetId),
    shelfStatus: shelfItem ? 'on_shelf' : 'available',
    readingStatus,
    progressRatio: readingStatus === 'unread' ? null : progressRatio,
    lastReadAt: toIsoString(state?.lastReadAt),
    completedAt: toIsoString(state?.completedAt),
    chapters: chaptersFromParts(parts, state),
    relatedIds: relatedWorks.map((w) => w.id),
  };
}

export type BookDetailQueryResult = {
  book: BookDetail;
  related: BookDetail[];
};

export async function fetchBookDetail(workId: string, init?: { signal?: AbortSignal }): Promise<BookDetailQueryResult> {
  const [work, shelfData, session, catalog] = await Promise.all([
    getPublishedWork(workId, init),
    getShelf(init).catch((error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 401) {
        return null;
      }
      throw error;
    }),
    // omit credentials → public reader session (parts only; no reading_state insert)
    getReaderSessionData(workId, { signal: init?.signal, credentials: 'omit' }),
    listCatalogWorks({ page: 1, pageSize: 12 }, init).catch(() => null),
  ]);

  const shelfMap = shelfData ? buildShelfItemMap(shelfData) : new Map<string, ShelfItem>();
  const relatedWorks = (catalog?.items ?? []).filter((item) => item.id !== workId).slice(0, RELATED_LIMIT);
  const book = toBookDetail(work, session.parts, shelfMap.get(workId), relatedWorks);
  const related = relatedWorks.map(workToRelatedStub);
  return { book, related };
}

export function useBookDetailQuery(workId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bookDetailQueryKey.detail(workId),
    queryFn: ({ signal }) => fetchBookDetail(workId, { signal }),
    enabled: options?.enabled ?? Boolean(workId),
  });
}

export const formatBookDetailApiError = formatApiError;
