import {
  type AdminReviewItemsData,
  adminReviewItemsDataSchema,
  type EnqueueReviewMaterializeResponse,
  enqueueReviewMaterializeResponseSchema,
  type GenerateReviewItemsResponse,
  generateReviewItemsResponseSchema,
  type ReplaceReviewItemsBody,
  type ReviewItemWrite,
} from '@gloaming/shared/api/review';

import { formatAdminApiError } from '@/features/admin/articles-api';
import { apiRequest } from '@/lib/api-request';

export { formatAdminApiError };

export type AdminReviewDraftItem = ReviewItemWrite;

export const adminReviewQueryKey = {
  all: ['admin-review'] as const,
  items: (articleId: string) => [...adminReviewQueryKey.all, 'items', articleId] as const,
};

export async function getAdminReviewItems(
  articleId: string,
  init?: { signal?: AbortSignal },
): Promise<AdminReviewItemsData> {
  return apiRequest(`/api/admin/articles/${encodeURIComponent(articleId)}/review-items`, {
    schema: adminReviewItemsDataSchema,
    signal: init?.signal,
  });
}

export async function replaceAdminReviewItems(
  articleId: string,
  body: ReplaceReviewItemsBody,
): Promise<AdminReviewItemsData> {
  return apiRequest(`/api/admin/articles/${encodeURIComponent(articleId)}/review-items`, {
    method: 'PUT',
    json: body,
    schema: adminReviewItemsDataSchema,
  });
}

export async function generateAdminReviewItems(articleId: string): Promise<GenerateReviewItemsResponse> {
  return apiRequest(`/api/admin/articles/${encodeURIComponent(articleId)}/review-items/generate`, {
    method: 'POST',
    json: {},
    schema: generateReviewItemsResponseSchema,
  });
}

export async function enqueueAdminReviewMaterialize(): Promise<EnqueueReviewMaterializeResponse> {
  return apiRequest('/api/admin/review/materialize', {
    method: 'POST',
    schema: enqueueReviewMaterializeResponseSchema,
  });
}

export function toReviewDraftItems(data: AdminReviewItemsData): AdminReviewDraftItem[] {
  return data.items.map(({ kind, sentence, focus, options, hintZh, correctOptionIndex, sortOrder }) => ({
    kind,
    sentence,
    focus,
    options,
    hintZh,
    correctOptionIndex,
    sortOrder,
  }));
}
