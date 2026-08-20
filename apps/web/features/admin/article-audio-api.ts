import {
  type ArticleAudioView,
  articleAudioViewSchema,
  type GenerateArticleAudioBody,
  type GenerateArticleAudioResult,
  generateArticleAudioResultSchema,
} from '@gloaming/shared/api/article-audio';

import { apiRequest, formatApiError } from '@/lib/api-request';

export const adminArticleAudioQueryKey = {
  all: ['admin-article-audio'] as const,
  detail: (articleId: string) => [...adminArticleAudioQueryKey.all, articleId] as const,
};

export async function getAdminArticleAudio(
  articleId: string,
  init?: { signal?: AbortSignal },
): Promise<ArticleAudioView> {
  return apiRequest(`/api/admin/articles/${encodeURIComponent(articleId)}/audio`, {
    schema: articleAudioViewSchema,
    signal: init?.signal,
  });
}

export async function generateAdminArticleAudio(
  articleId: string,
  body: GenerateArticleAudioBody = {},
): Promise<GenerateArticleAudioResult> {
  return apiRequest(`/api/admin/articles/${encodeURIComponent(articleId)}/audio/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    schema: generateArticleAudioResultSchema,
  });
}

export const formatAdminArticleAudioApiError = formatApiError;
