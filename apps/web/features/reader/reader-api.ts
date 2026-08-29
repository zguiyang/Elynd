import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ReaderAudioTrack,
  readerAudioTrackSchema,
  type ReaderSessionData,
  readerSessionDataSchema,
  readingStateSchema,
  type UpdateReadingStateBody,
} from '@gloaming/shared/api/reader';

import type { ReaderSession } from '@/features/reader/reader-model';
import { apiRequest, formatApiError } from '@/lib/api-request';

export const readerQueryKey = {
  all: ['reader'] as const,
  session: (workId: string, partId?: string | null) =>
    [...readerQueryKey.all, 'session', workId, partId ?? ''] as const,
};

export async function getReaderSessionData(
  workId: string,
  init?: { signal?: AbortSignal; credentials?: RequestCredentials; partId?: string | null },
): Promise<ReaderSessionData> {
  const qs = init?.partId ? `?partId=${encodeURIComponent(init.partId)}` : '';
  return apiRequest(`/api/reader/works/${encodeURIComponent(workId)}${qs}`, {
    schema: readerSessionDataSchema,
    signal: init?.signal,
    credentials: init?.credentials,
  });
}

export async function updateReadingState(
  workId: string,
  body: UpdateReadingStateBody,
  init?: { signal?: AbortSignal },
) {
  return apiRequest(`/api/reader/works/${encodeURIComponent(workId)}/state`, {
    method: 'PATCH',
    schema: readingStateSchema,
    json: body,
    signal: init?.signal,
  });
}

/** Silent shelf add — creates 0% state without opening reader. */
export async function addWorkToShelf(workId: string): Promise<void> {
  await updateReadingState(workId, { progressRatio: 0 });
}

export async function getReaderAudioTrack(
  partId: string,
  role: 'us' | 'uk',
  init?: { signal?: AbortSignal },
): Promise<ReaderAudioTrack> {
  const qs = new URLSearchParams({ role });
  return apiRequest(`/api/reader/parts/${encodeURIComponent(partId)}/audio?${qs}`, {
    schema: readerAudioTrackSchema,
    signal: init?.signal,
  });
}

export function toReaderSession(data: ReaderSessionData): ReaderSession {
  return {
    workId: data.work.id,
    partId: data.currentPart.id,
    title: data.work.title,
    tags: data.work.tags,
    html: data.currentPart.body,
    state: {
      status: data.state.status,
      progressRatio: data.state.progressRatio,
      lastReadAt:
        typeof data.state.lastReadAt === 'string' ? data.state.lastReadAt : data.state.lastReadAt.toISOString(),
      completedAt: data.state.completedAt
        ? typeof data.state.completedAt === 'string'
          ? data.state.completedAt
          : data.state.completedAt.toISOString()
        : null,
    },
    audioAvailable: data.audioAvailable,
  };
}

export function useReaderSessionQuery(workId: string, options?: { enabled?: boolean; partId?: string | null }) {
  const partId = options?.partId ?? null;
  return useQuery({
    queryKey: readerQueryKey.session(workId, partId),
    queryFn: ({ signal }) => getReaderSessionData(workId, { signal, partId }).then(toReaderSession),
    enabled: options?.enabled ?? Boolean(workId),
  });
}

export function useUpdateReadingStateMutation(workId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateReadingStateBody) => updateReadingState(workId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...readerQueryKey.all, 'session', workId] });
      void queryClient.invalidateQueries({ queryKey: ['shelf'] });
    },
  });
}

export const formatReaderApiError = formatApiError;
