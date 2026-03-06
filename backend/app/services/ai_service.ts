import { OpenAI } from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
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

      logger.info({ model: config.model, tokens: usage?.totalTokens ?? 0 }, 'AI stream completed')
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
        messages: params.messages as ChatCompletionMessageParam[],
        max_tokens: params.maxTokens,
        temperature: params.temperature ?? 0.7,
        response_format: params.responseFormat,
        stream,
      })

      const completionResponse = response as unknown as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      }
      const content = completionResponse.choices?.[0]?.message?.content || ''
      const usage = this.parseUsage(completionResponse.usage)

      logger.info({ model: config.model, tokens: usage.totalTokens }, 'AI chat completed')

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

    const getStatus = (err: unknown): number | undefined => {
      if (err && typeof err === 'object' && 'status' in err) {
        return (err as { status: number }).status
      }
      return undefined
    }

    const getCode = (err: unknown): string | undefined => {
      if (err && typeof err === 'object' && 'code' in err) {
        return (err as { code: string }).code
      }
      return undefined
    }

    const getMessage = (err: unknown): string => {
      if (err instanceof Error) {
        return err.message
      }
      return 'Request failed'
    }

    const status = getStatus(error)
    const code = getCode(error)
    const message = getMessage(error)

    if (status === 401) {
      return new AiServiceError(AI_ERROR_CODES.AUTH_ERROR, 'Invalid API key', error as Error)
    }
    if (status === 429) {
      return new AiServiceError(AI_ERROR_CODES.RATE_LIMIT, 'Rate limit exceeded', error as Error)
    }
    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
      return new AiServiceError(AI_ERROR_CODES.NETWORK_ERROR, 'Network error', error as Error)
    }

    return new AiServiceError(AI_ERROR_CODES.REQUEST_FAILED, message, error as Error)
  }
}
