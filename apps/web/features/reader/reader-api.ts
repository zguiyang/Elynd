import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PartSummary } from '@gloaming/shared';
import {
  readerAudioTrackSchema,
  type ReaderPartData,
  readerPartDataSchema,
  type ReaderPartsData,
  type ReadingState,
  type ReadingStateAction,
  readingStateDataSchema,
  type UpdateReadingStateBody,
} from '@gloaming/shared';

import type { ReaderViewModel } from '@/features/reader/reader-model';
import { patchReadingState } from '@/features/reading-state-command';
import { getWorkParts } from '@/features/works-http';
import { apiRequest, formatApiError } from '@/lib/api-request';
import { authClient } from '@/lib/auth';

export { addWorkToShelf, patchReadingState } from '@/features/reading-state-command';
export { getWorkParts as getReaderParts } from '@/features/works-http';

export const readerQueryKey = {
  all: ['reader'] as const,
  parts: (workId: string) => [...readerQueryKey.all, 'parts', workId] as const,
  part: (partId: string) => [...readerQueryKey.all, 'part', partId] as const,
  state: (workId: string) => [...readerQueryKey.all, 'state', workId] as const,
};

export async function getReaderPart(partId: string, init?: { signal?: AbortSignal }): Promise<ReaderPartData> {
  return apiRequest(`/api/reader/parts/${encodeURIComponent(partId)}`, {
    schema: readerPartDataSchema,
    signal: init?.signal,
  });
}

export async function getReadingState(workId: string, init?: { signal?: AbortSignal }): Promise<ReadingState | null> {
  try {
    const data = await apiRequest(`/api/reader/works/${encodeURIComponent(workId)}/state`, {
      schema: readingStateDataSchema,
      signal: init?.signal,
    });
    return data.state;
  } catch {
    return null;
  }
}

export async function getReaderAudioTrack(partId: string, role: 'us' | 'uk', init?: { signal?: AbortSignal }) {
  const qs = new URLSearchParams({ role });
  return apiRequest(`/api/reader/parts/${encodeURIComponent(partId)}/audio?${qs}`, {
    schema: readerAudioTrackSchema,
    signal: init?.signal,
  });
}

export function resolvePartId(
  parts: PartSummary[],
  state: ReadingState | null,
  preferredPartId: string | null,
): string {
  const sorted = [...parts].sort((a, b) => a.sortOrder - b.sortOrder);
  if (preferredPartId && sorted.some((part) => part.id === preferredPartId)) {
    return preferredPartId;
  }
  if (state?.currentPartId && sorted.some((part) => part.id === state.currentPartId)) {
    return state.currentPartId;
  }
  return sorted[0]!.id;
}

export function toReaderViewModel(
  partsData: ReaderPartsData,
  partData: ReaderPartData,
  state: ReadingState | null,
): ReaderViewModel {
  return {
    workId: partsData.work.id,
    workTitle: partsData.work.title,
    coverAssetId: partsData.work.coverAssetId,
    tags: partsData.work.tags,
    parts: partsData.parts,
    partId: partData.part.id,
    partTitle: partData.part.title,
    sortOrder: partData.part.sortOrder,
    html: partData.part.body,
    state: state
      ? {
          status: state.status,
          progressRatio: state.progressRatio,
          completedThroughSortOrder: state.completedThroughSortOrder,
          totalPartCount: state.totalPartCount,
          lastReadAt: typeof state.lastReadAt === 'string' ? state.lastReadAt : state.lastReadAt.toISOString(),
          completedAt: state.completedAt
            ? typeof state.completedAt === 'string'
              ? state.completedAt
              : state.completedAt.toISOString()
            : null,
        }
      : null,
    audioAvailable: partData.audioAvailable,
  };
}

export function useReaderPartsQuery(workId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: readerQueryKey.parts(workId),
    queryFn: ({ signal }) => getWorkParts(workId, { signal }),
    enabled: options?.enabled ?? Boolean(workId),
  });
}

export function useReaderPartQuery(partId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: readerQueryKey.part(partId ?? ''),
    queryFn: ({ signal }) => getReaderPart(partId!, { signal }),
    enabled: (options?.enabled ?? true) && Boolean(partId),
  });
}

export function useReadingStateQuery(workId: string, options?: { enabled?: boolean }) {
  const { data: authData } = authClient.useSession();
  const isAuthenticated = Boolean(authData?.user);
  return useQuery({
    queryKey: readerQueryKey.state(workId),
    queryFn: ({ signal }) => getReadingState(workId, { signal }),
    enabled: (options?.enabled ?? Boolean(workId)) && isAuthenticated,
  });
}

export function useReaderStateMutation(workId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateReadingStateBody) => patchReadingState(workId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: readerQueryKey.state(workId) });
      void queryClient.invalidateQueries({ queryKey: ['shelf'] });
      void queryClient.invalidateQueries({ queryKey: ['book-detail'] });
    },
  });
}

export type { ReadingStateAction };

export const formatReaderApiError = formatApiError;
