export interface AiClientConfig {
  baseUrl: string
  apiKey: string
  model: string
  timeout?: number
  maxRetries?: number
}

export interface AiChatParams {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  maxTokens?: number
  temperature?: number
  responseFormat?: { type: 'text' | 'json_object' }
}

export interface AiResponse {
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AiStreamChunk {
  delta: string
  isComplete: boolean
}

export interface AiStreamHandlers {
  onChunk: (chunk: AiStreamChunk) => void
  onComplete: (response: AiResponse) => void
  onError: (error: AiServiceError) => void
}

export const AI_ERROR_CODES = {
  INVALID_CONFIG: 'INVALID_CONFIG',
  REQUEST_FAILED: 'REQUEST_FAILED',
  PARSE_ERROR: 'PARSE_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  AUTH_ERROR: 'AUTH_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const

export class AiServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'AiServiceError'
  }
}
