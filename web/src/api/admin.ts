import request from '@/lib/request'

export interface GenerateArticleData {
  difficultyLevel: 'L1' | 'L2' | 'L3'
  topic: string
  extraInstructions?: string
}

export interface Article {
  id: number
  title: string
  content: string
  difficultyLevel: string
  createdAt: string
}

export interface SystemConfig {
  aiBaseUrl: string
  aiApiKey: string
  aiModelName: string
}

export const adminApi = {
  generateArticle: (data: GenerateArticleData) =>
    request.post<Article>('/api/admin/articles/generate', data).then(res => res.data),

  getSystemConfig: () =>
    request.get<SystemConfig>('/api/admin/system-config').then(res => res.data),

  updateSystemConfig: (data: SystemConfig) =>
    request.put<SystemConfig>('/api/admin/system-config', data).then(res => res.data),
}
