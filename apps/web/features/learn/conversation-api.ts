import {
  type ConversationDetail,
  conversationDetailSchema,
  type ConversationListData,
  conversationListDataSchema,
  type ConversationSummary,
  conversationSummarySchema,
  type CreateConversationBody,
} from '@gloaming/shared/api/conversations';

import { apiRequest, formatApiError } from '@/lib/api-request';

export const conversationQueryKey = {
  all: ['conversations'] as const,
  list: (filters: { articleId: string }) =>
    [...conversationQueryKey.all, 'list', 'assist-read', 'article', filters.articleId] as const,
  detail: (id: string) => [...conversationQueryKey.all, 'detail', id] as const,
};

export async function createAssistConversation(
  articleId: string,
  init?: { signal?: AbortSignal },
): Promise<ConversationSummary> {
  const body: CreateConversationBody = {
    surface: 'assist-read',
    subjectType: 'article',
    subjectId: articleId,
  };
  return apiRequest('/api/conversations', {
    method: 'POST',
    schema: conversationSummarySchema,
    json: body,
    signal: init?.signal,
  });
}

export async function listArticleAssistConversations(
  articleId: string,
  init?: { signal?: AbortSignal; page?: number; pageSize?: number },
): Promise<ConversationListData> {
  const params = new URLSearchParams({
    surface: 'assist-read',
    subjectType: 'article',
    subjectId: articleId,
    page: String(init?.page ?? 1),
    pageSize: String(init?.pageSize ?? 20),
    sortBy: 'lastMessageAt',
    sortOrder: 'desc',
  });
  return apiRequest(`/api/conversations?${params.toString()}`, {
    schema: conversationListDataSchema,
    signal: init?.signal,
  });
}

export async function getConversation(
  conversationId: string,
  init?: { signal?: AbortSignal },
): Promise<ConversationDetail> {
  return apiRequest(`/api/conversations/${encodeURIComponent(conversationId)}`, {
    schema: conversationDetailSchema,
    signal: init?.signal,
  });
}

export const formatConversationApiError = formatApiError;
