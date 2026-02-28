import { OpenAI } from 'openai'
import logger from '@adonisjs/core/services/logger'
import { inject } from '@adonisjs/core'
import type { AiClientConfig, AiChatParams, AiResponse, AiStreamHandlers } from '#types/ai'
import { AiServiceError, AI_ERROR_CODES } from '#types/ai'
import { AI } from '#constants'

@inject()
export class AiService {
  private client: OpenAI | null = null
  private lastConfigHash: string | null = null

  async chat(config: AiClientConfig, params: AiChatParams): Promise<string> {
    const response = await this.doChat(config, params, false)
    return response.content
  }

  async chatJson<T>(config: AiClientConfig, params: AiChatParams): Promise<T> {
    const response = await this.doChat(config, params, false)

    try {
      return JSON.parse(response.content)
    } catch (error) {
      throw new AiServiceError(
        AI_ERROR_CODES.PARSE_ERROR,
        'Failed to parse AI response as JSON',
        error as Error
      )
    }
  }

  async streamChat(
    config: AiClientConfig,
    params: AiChatParams,
    handlers: AiStreamHandlers
  ): Promise<void> {
    this.validateConfig(config)
    const client = this.getClient(config)

    try {
      const stream = await client.chat.completions.create({
        model: config.model,
        messages: params.messages,
        max_tokens: params.maxTokens,
        temperature: params.temperature ?? 0.7,
        stream: true,
        stream_options: { include_usage: true },
      })

      let fullContent = ''
      let usage: AiResponse['usage'] | undefined

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || ''

        if (delta) {
          fullContent += delta
          handlers.onChunk({ delta, isComplete: false })
        }

        if (chunk.usage) {
          usage = this.parseUsage(chunk.usage)
        }
      }

      handlers.onChunk({ delta: '', isComplete: true })

      handlers.onComplete({
        content: fullContent,
        usage: usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      })

      logger.info('AI stream completed: model=%s, tokens=%d', config.model, usage?.totalTokens ?? 0)
    } catch (error) {
      handlers.onError(this.handleError(error))
    }
  }

  private async doChat(
    config: AiClientConfig,
    params: AiChatParams,
    stream: boolean
  ): Promise<AiResponse> {
    this.validateConfig(config)
    const client = this.getClient(config)

    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: params.messages,
        max_tokens: params.maxTokens,
        temperature: params.temperature ?? 0.7,
        response_format: params.responseFormat as any,
        stream,
      })

      const content = (response as any).choices[0]?.message?.content || ''
      const usage = this.parseUsage((response as any).usage)

      logger.info('AI chat completed: model=%s, tokens=%d', config.model, usage.totalTokens)

      return { content, usage }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  private getClient(config: AiClientConfig): OpenAI {
    const configHash = `${config.baseUrl}:${config.apiKey}:${config.model}`

    if (this.client && this.lastConfigHash === configHash) {
      return this.client
    }

    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout ?? AI.DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? AI.DEFAULT_MAX_RETRIES,
    })
    this.lastConfigHash = configHash

    return this.client
  }

  private validateConfig(config: AiClientConfig): void {
    if (!config.baseUrl) {
      throw new AiServiceError(AI_ERROR_CODES.INVALID_CONFIG, 'AI base URL is required')
    }
    if (!config.apiKey) {
      throw new AiServiceError(AI_ERROR_CODES.INVALID_CONFIG, 'AI API key is required')
    }
    if (!config.model) {
      throw new AiServiceError(AI_ERROR_CODES.INVALID_CONFIG, 'AI model is required')
    }
  }

  private parseUsage(usage: any): AiResponse['usage'] {
    return {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    }
  }

  private handleError(error: unknown): AiServiceError {
    if (error instanceof AiServiceError) {
      return error
    }

    const err = error as any

    if (err.status === 401) {
      return new AiServiceError(AI_ERROR_CODES.AUTH_ERROR, 'Invalid API key', err)
    }
    if (err.status === 429) {
      return new AiServiceError(AI_ERROR_CODES.RATE_LIMIT, 'Rate limit exceeded', err)
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      return new AiServiceError(AI_ERROR_CODES.NETWORK_ERROR, 'Network error', err)
    }

    return new AiServiceError(AI_ERROR_CODES.REQUEST_FAILED, err.message || 'Request failed', err)
  }
}
