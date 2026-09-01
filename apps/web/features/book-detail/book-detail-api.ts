/**
 * Book detail data layer — catalog/shelf/parts + derived reading stats from API.
 * Reader parts fetch uses credentials: 'omit' so viewing detail does not create reading_state.
 */

import { useQuery } from '@tanstack/react-query';

import type { ReadingState } from '@gloaming/shared/api/reader';
import { difficultyLabelFromScore } from '@gloaming/shared/api/reading-stats';
import type { ShelfItem } from '@gloaming/shared/api/shelf';
import { type PartSummary, type Work, workSchema } from '@gloaming/shared/api/works';

import {
  type BookChapter,
  type BookDetail,
  coverUrlFromAssetId,
  languageLabelFromCode,
  readingStatusFromProgress,
  teaserFromDescription,
} from '@/features/book-detail/book-detail-model';
import { buildShelfItemMap, listCatalogWorks } from '@/features/discover/discover-api';
import { getReaderParts } from '@/features/reader/reader-api';
import { getShelf } from '@/features/shelf/shelf-api';
import { apiRequest, ApiRequestError, formatApiError } from '@/lib/api-request';

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

function difficultyLabelFromWork(work: Work): string | null {
  if (work.difficultyScore == null) {
    return null;
  }
  return difficultyLabelFromScore(work.difficultyScore);
}

function partStatsFields(part: PartSummary): Pick<BookChapter, 'estimatedMinutes' | 'wordCount'> {
  return {
    estimatedMinutes: part.estimatedMinutes ?? null,
    wordCount: part.wordCount ?? null,
  };
}

export function chaptersFromParts(parts: PartSummary[], state: ReadingState | null): BookChapter[] {
  const sorted = [...parts].sort((a, b) => a.sortOrder - b.sortOrder);
  const readingStatus = state ? readingStatusFromProgress(state.status, state.progressRatio) : 'unread';

  if (readingStatus === 'unread') {
    return sorted.map((part, i) => ({
      id: part.id,
      index: i + 1,
      title: part.title || `第 ${i + 1} 章`,
      ...partStatsFields(part),
      status: 'unread' as const,
    }));
  }

  if (readingStatus === 'completed') {
    return sorted.map((part, i) => ({
      id: part.id,
      index: i + 1,
      title: part.title || `第 ${i + 1} 章`,
      ...partStatsFields(part),
      status: 'read' as const,
    }));
  }

  const currentId = state?.currentPartId;

  return sorted.map((part, i) => {
    let status: BookChapter['status'] = 'unread';
    if (part.sortOrder <= (state?.completedThroughSortOrder ?? -1)) {
      status = 'read';
    } else if (part.id === currentId) {
      status = 'current';
    }
    return {
      id: part.id,
      index: i + 1,
      title: part.title || `第 ${i + 1} 章`,
      ...partStatsFields(part),
      status,
    };
  });
}

function workToRelatedStub(work: Work): BookDetail {
  return {
    id: work.id,
    title: work.title,
    author: work.author,
    difficultyScore: work.difficultyScore,
    difficultyLabel: difficultyLabelFromWork(work),
    category: work.tags[0] ?? '读物',
    tags: work.tags,
    estimatedMinutes: work.estimatedMinutes,
    suggestedVocabSize: work.suggestedVocabSize,
    teaser: teaserFromDescription(work.description),
    sourceLabel: '官方',
    languageLabel: languageLabelFromCode(work.language),
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
    difficultyScore: work.difficultyScore,
    difficultyLabel: difficultyLabelFromWork(work),
    category: work.tags[0] ?? '读物',
    tags: work.tags,
    estimatedMinutes: work.estimatedMinutes,
    suggestedVocabSize: work.suggestedVocabSize,
    teaser,
    sourceLabel: '官方',
    languageLabel: languageLabelFromCode(work.language),
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
  const [work, shelfData, partsData, catalog] = await Promise.all([
    getPublishedWork(workId, init),
    getShelf(init).catch((error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 401) {
        return null;
      }
      throw error;
    }),
    getReaderParts(workId, init),
    listCatalogWorks({ page: 1, pageSize: 12 }, init).catch(() => null),
  ]);

  const shelfMap = shelfData ? buildShelfItemMap(shelfData) : new Map<string, ShelfItem>();
  const relatedWorks = (catalog?.items ?? []).filter((item) => item.id !== workId).slice(0, RELATED_LIMIT);
  const book = toBookDetail(work, partsData.parts, shelfMap.get(workId), relatedWorks);
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
