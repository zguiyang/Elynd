import request from '@/lib/request'
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
    request.get<PaginatedResponse<ArticleListItem>>('/api/articles', { params }),

  getById: (id: number) => request.get<Article>(`/api/articles/${id}`),

  getChapter: (articleId: number, chapterIndex: number) =>
    request.get<Chapter>(`/api/articles/${articleId}/chapters/${chapterIndex}`),

  getTags: () => request.get<Tag[]>('/api/tags'),

  getVocabulary: (articleId: number) =>
    request.get<VocabularyItem[]>(`/api/articles/${articleId}/vocabulary`),
}
