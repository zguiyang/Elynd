import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import {
  type GeneratePartAudioBody,
  generatePartAudioResultSchema,
  partAudioViewSchema,
} from '@gloaming/shared/api/content-assets';
import {
  adminWorkListDataSchema,
  type AdminWorkListQuery,
  adminWorkSchema,
  type CreateAdminTextWorkBody,
  type UpdatePartBody,
  type UpdateWorkBody,
} from '@gloaming/shared/api/works';

import { type AdminWorkView, normalizeAdminWork } from '@/features/works-http';
import { apiRequest, formatApiError } from '@/lib/api-request';

export const adminWorksQueryKey = {
  all: ['admin', 'works'] as const,
  list: (query: Partial<AdminWorkListQuery>) => [...adminWorksQueryKey.all, 'list', query] as const,
  detail: (id: string) => [...adminWorksQueryKey.all, 'detail', id] as const,
};

export const adminPartAudioQueryKey = {
  all: ['admin', 'part-audio'] as const,
  detail: (partId: string) => [...adminPartAudioQueryKey.all, partId] as const,
};

export async function listAdminWorks(query: Partial<AdminWorkListQuery> = {}, init?: { signal?: AbortSignal }) {
  const search = new URLSearchParams();
  if (query.page) search.set('page', String(query.page));
  if (query.pageSize) search.set('pageSize', String(query.pageSize));
  if (query.status) search.set('status', query.status);
  const qs = search.toString();
  const data = await apiRequest(`/api/admin/works${qs ? `?${qs}` : ''}`, {
    schema: adminWorkListDataSchema,
    signal: init?.signal,
  });
  return { ...data, items: data.items.map(normalizeAdminWork) };
}

export async function getAdminWork(id: string, init?: { signal?: AbortSignal }): Promise<AdminWorkView> {
  const raw = await apiRequest(`/api/admin/works/${encodeURIComponent(id)}`, {
    schema: adminWorkSchema,
    signal: init?.signal,
  });
  return normalizeAdminWork(raw);
}

export async function createAdminTextWork(body: CreateAdminTextWorkBody, init?: { signal?: AbortSignal }) {
  const raw = await apiRequest('/api/admin/works', {
    method: 'POST',
    schema: adminWorkSchema,
    json: body,
    signal: init?.signal,
  });
  return normalizeAdminWork(raw);
}

export async function updateAdminWork(id: string, body: UpdateWorkBody, init?: { signal?: AbortSignal }) {
  const raw = await apiRequest(`/api/admin/works/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    schema: adminWorkSchema,
    json: body,
    signal: init?.signal,
  });
  return normalizeAdminWork(raw);
}

export async function updateAdminPart(
  workId: string,
  partId: string,
  body: UpdatePartBody,
  init?: { signal?: AbortSignal },
) {
  const raw = await apiRequest(`/api/admin/works/${encodeURIComponent(workId)}/parts/${encodeURIComponent(partId)}`, {
    method: 'PATCH',
    schema: adminWorkSchema,
    json: body,
    signal: init?.signal,
  });
  return normalizeAdminWork(raw);
}

export async function publishAdminWork(id: string, init?: { signal?: AbortSignal }) {
  const raw = await apiRequest(`/api/admin/works/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    schema: adminWorkSchema,
    signal: init?.signal,
  });
  return normalizeAdminWork(raw);
}

export async function unpublishAdminWork(id: string, init?: { signal?: AbortSignal }) {
  const raw = await apiRequest(`/api/admin/works/${encodeURIComponent(id)}/unpublish`, {
    method: 'POST',
    schema: adminWorkSchema,
    signal: init?.signal,
  });
  return normalizeAdminWork(raw);
}

export async function deleteAdminWork(id: string, init?: { signal?: AbortSignal }) {
  await apiRequest(`/api/admin/works/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    schema: z.void(),
    signal: init?.signal,
  });
}

export async function getAdminPartAudio(partId: string, init?: { signal?: AbortSignal }) {
  return apiRequest(`/api/admin/parts/${encodeURIComponent(partId)}/audio`, {
    schema: partAudioViewSchema,
    signal: init?.signal,
  });
}

export async function generateAdminPartAudio(
  partId: string,
  body: GeneratePartAudioBody = {},
  init?: { signal?: AbortSignal },
) {
  return apiRequest(`/api/admin/parts/${encodeURIComponent(partId)}/audio/generate`, {
    method: 'POST',
    schema: generatePartAudioResultSchema,
    json: body,
    signal: init?.signal,
  });
}

export function useAdminWorksListQuery(query: Partial<AdminWorkListQuery> = {}) {
  return useQuery({
    queryKey: adminWorksQueryKey.list(query),
    queryFn: ({ signal }) => listAdminWorks(query, { signal }),
  });
}

export function useAdminWorkQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: adminWorksQueryKey.detail(id),
    queryFn: ({ signal }) => getAdminWork(id, { signal }),
    enabled: options?.enabled ?? Boolean(id),
  });
}

export function useInvalidateAdminWorks() {
  const queryClient = useQueryClient();
  return async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: adminWorksQueryKey.all });
    if (id) {
      await queryClient.invalidateQueries({ queryKey: adminWorksQueryKey.detail(id) });
    }
  };
}

export const formatWorksApiError = formatApiError;
