import {
  type AdminPracticeItemsData,
  adminPracticeItemsDataSchema,
  type GeneratePracticeItemsResponse,
  generatePracticeItemsResponseSchema,
  type PracticeItemWrite,
  type ReplacePracticeItemsBody,
} from '@elynd/shared/api/learn';

import { formatAdminApiError } from '@/features/admin/articles-api';
import { apiRequest } from '@/lib/api-request';

export { formatAdminApiError };

export type AdminPracticeDraftItem = PracticeItemWrite;

export const adminPracticeQueryKey = {
  all: ['admin-practice'] as const,
  items: (articleId: string) => [...adminPracticeQueryKey.all, 'items', articleId] as const,
};

export async function getAdminPracticeItems(
  articleId: string,
  init?: { signal?: AbortSignal },
): Promise<AdminPracticeItemsData> {
  return apiRequest(`/api/admin/articles/${encodeURIComponent(articleId)}/practice-items`, {
    schema: adminPracticeItemsDataSchema,
    signal: init?.signal,
  });
}

export async function replaceAdminPracticeItems(
  articleId: string,
  body: ReplacePracticeItemsBody,
): Promise<AdminPracticeItemsData> {
  return apiRequest(`/api/admin/articles/${encodeURIComponent(articleId)}/practice-items`, {
    method: 'PUT',
    json: body,
    schema: adminPracticeItemsDataSchema,
  });
}

export async function generateAdminPracticeItems(articleId: string): Promise<GeneratePracticeItemsResponse> {
  return apiRequest(`/api/admin/articles/${encodeURIComponent(articleId)}/practice-items/generate`, {
    method: 'POST',
    json: {},
    schema: generatePracticeItemsResponseSchema,
  });
}

export function toDraftItems(data: AdminPracticeItemsData): AdminPracticeDraftItem[] {
  return data.items.map(({ kind, payload, correctOptionIndex, sortOrder }) => ({
    kind,
    payload,
    correctOptionIndex,
    sortOrder,
  }));
}
