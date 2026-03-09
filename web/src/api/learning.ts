import { request } from '@/lib/request'

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
  login: () =>
    request<{ learningDays: number; isFirstLoginToday: boolean }>({ method: 'POST', url: '/api/learning/login' }),

  updateProgress: (articleId: number, progress: number) =>
    request<{ articleId: number; progress: number }>({
      method: 'PUT',
      url: '/api/learning/progress',
      data: { articleId, progress },
    }),

  getIndex: () =>
    request<LearningIndexData>({ method: 'GET', url: '/api/learning/index' }),

  getRecommendations: () =>
    request<RecommendedArticle[]>({ method: 'GET', url: '/api/learning/recommend' }),
}
