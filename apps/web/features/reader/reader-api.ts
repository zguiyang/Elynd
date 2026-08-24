import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ReaderAudioTrack,
  readerAudioTrackSchema,
  type ReaderSessionData,
  readerSessionDataSchema,
  readingProgressSchema,
  type UpdateReadingProgressBody,
} from '@gloaming/shared/api/reader';

import { paragraphsFromBody } from '@/features/content/content-model';
import type { ReaderParagraph, ReaderSession } from '@/features/reader/reader-model';
import { apiRequest, formatApiError } from '@/lib/api-request';

export const readerQueryKey = {
  all: ['reader'] as const,
  session: (articleId: string) => [...readerQueryKey.all, 'session', articleId] as const,
};

export async function getReaderSessionData(
  articleId: string,
  init?: { signal?: AbortSignal },
): Promise<ReaderSessionData> {
  return apiRequest(`/api/reader/articles/${encodeURIComponent(articleId)}`, {
    schema: readerSessionDataSchema,
    signal: init?.signal,
  });
}

export async function updateReadingProgress(
  articleId: string,
  body: UpdateReadingProgressBody,
  init?: { signal?: AbortSignal },
) {
  return apiRequest(`/api/reader/articles/${encodeURIComponent(articleId)}/progress`, {
    method: 'PATCH',
    schema: readingProgressSchema,
    json: body,
    signal: init?.signal,
  });
}

/** Silent shelf add — creates 0% progress without opening reader. */
export async function addArticleToShelf(articleId: string): Promise<void> {
  await updateReadingProgress(articleId, { progressRatio: 0 });
}

export async function getReaderAudioTrack(
  articleId: string,
  role: 'us' | 'uk',
  init?: { signal?: AbortSignal },
): Promise<ReaderAudioTrack> {
  const qs = new URLSearchParams({ role });
  return apiRequest(`/api/reader/articles/${encodeURIComponent(articleId)}/audio?${qs}`, {
    schema: readerAudioTrackSchema,
    signal: init?.signal,
  });
}

export function toReaderParagraphs(articleId: string, body: string): ReaderParagraph[] {
  return paragraphsFromBody(body).map((text, index) => ({
    id: `${articleId}-p${index + 1}`,
    index: index + 1,
    text,
  }));
}

export function toReaderSession(data: ReaderSessionData): ReaderSession {
  return {
    id: data.id,
    title: data.title,
    level: data.level,
    themes: data.themes,
    estimatedMinutes: data.estimatedMinutes,
    paragraphs: toReaderParagraphs(data.id, data.body),
    progress: {
      status: data.progress.status,
      progressRatio: data.progress.progressRatio,
      lastReadAt:
        typeof data.progress.lastReadAt === 'string'
          ? data.progress.lastReadAt
          : data.progress.lastReadAt.toISOString(),
      completedAt: data.progress.completedAt
        ? typeof data.progress.completedAt === 'string'
          ? data.progress.completedAt
          : data.progress.completedAt.toISOString()
        : null,
    },
    audioAvailable: data.audioAvailable,
  };
}

export function useReaderSessionQuery(articleId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: readerQueryKey.session(articleId),
    queryFn: ({ signal }) => getReaderSessionData(articleId, { signal }).then(toReaderSession),
    enabled: options?.enabled ?? Boolean(articleId),
  });
}

export function useUpdateReadingProgressMutation(articleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateReadingProgressBody) => updateReadingProgress(articleId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: readerQueryKey.session(articleId) });
      void queryClient.invalidateQueries({ queryKey: ['shelf'] });
    },
  });
}

export const formatReaderApiError = formatApiError;
