import { request } from '@/lib/request'
import type {
  Article,
  ArticleListItem,
  ArticleListParams,
  Chapter,
  PaginatedResponse,
  Tag,
  VocabularyItem,
} from '@/types/article'

export const articleApi = {
  list: (params?: ArticleListParams) =>
    request<PaginatedResponse<ArticleListItem>>({ method: 'GET', url: '/api/articles', params }),

  getById: (id: number) =>
    request<Article>({ method: 'GET', url: `/api/articles/${id}` }),

  getChapter: (articleId: number, chapterIndex: number) =>
    request<Chapter>({ method: 'GET', url: `/api/articles/${articleId}/chapters/${chapterIndex}` }),

  getTags: () =>
    request<Tag[]>({ method: 'GET', url: '/api/tags' }),

  getVocabulary: (articleId: number) =>
    request<VocabularyItem[]>({ method: 'GET', url: `/api/articles/${articleId}/vocabulary` }),
}
