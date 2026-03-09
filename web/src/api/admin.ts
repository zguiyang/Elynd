import { request } from '@/lib/request'

export interface GenerateArticleData {
  difficultyLevel: 'L1' | 'L2' | 'L3'
  topic: string
  extraInstructions?: string
}

export interface GenerateArticleResponse {
  jobId: string
  status: 'queued'
}

export interface SystemConfig {
  aiBaseUrl: string
  aiApiKey: string
  aiModelName: string
}

export const adminApi = {
  generateArticle: (data: GenerateArticleData) =>
    request<GenerateArticleResponse>({ method: 'POST', url: '/api/admin/articles/generate', data }),

  getSystemConfig: () =>
    request<SystemConfig>({ method: 'GET', url: '/api/admin/system-config' }),

  updateSystemConfig: (data: SystemConfig) =>
    request<SystemConfig>({ method: 'PUT', url: '/api/admin/system-config', data }),
}
