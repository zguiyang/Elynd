export interface UserAiConfig {
  enabled: boolean
  apiKey?: string
  baseUrl?: string
  modelName?: string
}

export interface AiChatParams {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    name?: string
    tool_calls?: any[]
    tool_call_id?: string
  }>
  tools?: any[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  response_format?: { type: 'text' | 'json_object' }
  user?: string
}

export interface AiStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason?: string | null
  }>
}

export interface AiChatSuccessResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: Array<{
        id: string
        type: string
        function: {
          name: string
          arguments: string
        }
      }>
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface AiChatResponseError {
  success: false
  error: {
    code: string
    message: string
    type?: string
    param?: string
  }
}

export type AiChatResponse =
  | (AiChatSuccessResponse & { success: true })
  | AiChatResponseError
  | { success: true; data: any } // For raw stream or other cases

export interface AiStreamHandler {
  onChunk: (chunk: AiStreamChunk) => void
  onComplete?: (response: AiChatSuccessResponse) => void
  onError: (error: AiChatResponseError) => void
}
