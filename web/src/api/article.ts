import request from '@/lib/request'
import type {
  Article,
  ArticleListItem,
  ArticleListParams,
  PaginatedResponse,
  Tag,
  VocabularyItem,
} from '@/types/article'

export const articleApi = {
  list: (params?: ArticleListParams) =>
    request.get<PaginatedResponse<ArticleListItem>>('/api/articles', { params }),

  getById: (id: number) => request.get<Article>(`/api/articles/${id}`),

  getTags: () => request.get<Tag[]>('/api/tags'),

  getVocabulary: (articleId: number) =>
    request.get<VocabularyItem[]>(`/api/articles/${articleId}/vocabulary`),
}
