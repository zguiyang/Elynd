import request from '@/lib/request'

export interface LearningIndexData {
  learningDays: number
  articlesReadCount: number
  continueReading: Array<{
    id: number
    title: string
    difficulty: string
    category: string
    progress: number
  }>
  recommendedArticles: Array<{
    id: number
    title: string
    difficulty: string
    category: string
    description: string | null
  }>
}

export interface RecommendedArticle {
  id: number
  title: string
  difficulty: string
  category: string
  description: string | null
}

export const learningApi = {
  login: () => request.post<{ learningDays: number; isFirstLoginToday: boolean }>('/api/learning/login'),

  updateProgress: (articleId: number, progress: number) =>
    request.put<{ articleId: number; progress: number }>('/api/learning/progress', {
      articleId,
      progress,
    }),

  getIndex: () => request.get<LearningIndexData>('/api/learning/index'),

  getRecommendations: () => request.get<RecommendedArticle[]>('/api/learning/recommend'),
}
