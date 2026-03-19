import { request } from '@/lib/request'

export interface LearningIndexData {
  learningDays: number
  booksReadCount: number
  continueReading: Array<{
    id: number
    title: string
    level: {
      id: number
      code: string
      description: string
      sortOrder: number
    }
    category: string
    progress: number
  }>
  recommendedBooks: Array<{
    id: number
    title: string
    level: {
      id: number
      code: string
      description: string
      sortOrder: number
    }
    category: string
    description: string | null
  }>
}

export interface RecommendedBook {
  id: number
  title: string
  level: {
    id: number
    code: string
    description: string
    sortOrder: number
  }
  category: string
  description: string | null
}

export const learningApi = {
  login: () =>
    request<{ learningDays: number; isFirstLoginToday: boolean }>({ method: 'POST', url: '/api/learning/login' }),

  updateProgress: (bookId: number, progress: number) =>
    request<{ bookId: number; progress: number }>({
      method: 'PUT',
      url: '/api/learning/progress',
      data: { bookId, progress },
    }),

  getIndex: () =>
    request<LearningIndexData>({ method: 'GET', url: '/api/learning/index' }),

  getRecommendations: () =>
    request<RecommendedBook[]>({ method: 'GET', url: '/api/learning/recommend' }),
}
