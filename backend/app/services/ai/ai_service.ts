import { OpenAI } from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import logger from '@adonisjs/core/services/logger'
import { inject } from '@adonisjs/core'
import type { AiClientConfig, AiChatParams, AiResponse, AiStreamHandlers } from '#types/ai'
import { AiServiceError, AI_ERROR_CODES } from '#types/ai'
import { AI } from '#constants'

interface ChunkedRunContext<TChunkItem> {
  chunkItems: TChunkItem[]
  chunkIndex: number
  chunkCount: number
}

interface ChatJsonChunkedOptions<TChunkItem, TChunkResult, TMergedResult> {
  items: TChunkItem[]
  maxChunkChars: number
  maxChunkItems: number
  getItemChars: (item: TChunkItem) => number
  buildParams: (context: ChunkedRunContext<TChunkItem>) => AiChatParams
  onChunkError?: (
    context: ChunkedRunContext<TChunkItem> & { error: unknown }
  ) => Promise<TChunkResult>
  mergeResults: (
    results: Array<{ context: ChunkedRunContext<TChunkItem>; result: TChunkResult }>
  ) => TMergedResult
  logLabel: string
}

@inject()
export class AiService {
  async chat(config: AiClientConfig, params: AiChatParams): Promise<string> {
    const response = await this.doChat(config, params, false)
    return response.content
  }

  async chatJson<T>(config: AiClientConfig, params: AiChatParams): Promise<T> {
    let lastParseError: Error | null = null

    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await this.doChat(config, params, false)

      try {
        return this.parseJsonFromResponse<T>(response.content)
      } catch (error) {
        lastParseError = error instanceof Error ? error : new Error('Unknown JSON parse error')

        logger.warn(
          {
            model: config.model,
            attempt,
            errorMessage: lastParseError.message,
            rawResponse: response.content.substring(0, 500),
          },
          'AI chat JSON parse failed'
        )

        if (attempt === 2) {
          logger.error({ rawResponse: response.content }, 'AI chat JSON parse failed after 2 attempts, raw response above')
          throw new AiServiceError(
            AI_ERROR_CODES.PARSE_ERROR,
            'Failed to parse AI response as JSON',
            lastParseError
          )
        }
      }
    }

    throw new AiServiceError(
      AI_ERROR_CODES.PARSE_ERROR,
      'Failed to parse AI response as JSON',
      lastParseError || undefined
    )
  }

  async chatJsonChunked<TChunkItem, TChunkResult, TMergedResult>(
    config: AiClientConfig,
    options: ChatJsonChunkedOptions<TChunkItem, TChunkResult, TMergedResult>
  ): Promise<TMergedResult> {
    const {
      items,
      maxChunkChars,
      maxChunkItems,
      getItemChars,
      buildParams,
      onChunkError,
      mergeResults,
      logLabel,
    } = options

    if (items.length === 0) {
      return mergeResults([])
    }

    const chunks = this.createChunks(items, maxChunkChars, maxChunkItems, getItemChars)
    const chunkResults: Array<{
      context: ChunkedRunContext<TChunkItem>
      result: TChunkResult
    }> = []

    for (let index = 0; index < chunks.length; index++) {
      const chunkItems = chunks[index]
      const chunkInputChars = chunkItems.reduce((sum, item) => sum + getItemChars(item), 0)
      const startedAt = Date.now()
      logger.info(
        {
          label: logLabel,
          chunkIndex: index + 1,
          chunkCount: chunks.length,
          chunkItems: chunkItems.length,
          chunkInputChars,
          timeout: AI.DEFAULT_TIMEOUT,
        },
        'AI chunk request started'
      )

      try {
        const context = {
          chunkItems,
          chunkIndex: index + 1,
          chunkCount: chunks.length,
        }
        const chunkResult = await this.chatJson<TChunkResult>(config, buildParams(context))
        chunkResults.push({ context, result: chunkResult })
        logger.info(
          {
            label: logLabel,
            chunkIndex: index + 1,
            chunkCount: chunks.length,
            chunkInputChars,
            elapsedMs: Date.now() - startedAt,
            timeout: AI.DEFAULT_TIMEOUT,
          },
          'AI chunk request completed'
        )
      } catch (error) {
        const handledError = this.handleError(error)
        logger.warn(
          {
            label: logLabel,
            chunkIndex: index + 1,
            chunkCount: chunks.length,
            chunkInputChars,
            elapsedMs: Date.now() - startedAt,
            timeout: AI.DEFAULT_TIMEOUT,
            errorCode: handledError.code,
            err: handledError,
          },
          'AI chunk request failed'
        )

        if (!onChunkError) {
          throw handledError
        }

        const fallbackContext = {
          chunkItems,
          chunkIndex: index + 1,
          chunkCount: chunks.length,
        }
        const fallbackResult = await onChunkError({ ...fallbackContext, error })
        logger.info(
          {
            label: logLabel,
            chunkIndex: index + 1,
            chunkCount: chunks.length,
            chunkInputChars,
            elapsedMs: Date.now() - startedAt,
            timeout: AI.DEFAULT_TIMEOUT,
            usedFallback: true,
          },
          'AI chunk fallback completed'
        )
        chunkResults.push({ context: fallbackContext, result: fallbackResult })
      }
    }

    return mergeResults(chunkResults)
  }

  private parseJsonFromResponse<T>(content: string): T {
    const candidates = new Set<string>()
    const trimmed = content.trim()

    if (trimmed) {
      candidates.add(trimmed)
    }

    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim()
    if (fenced) {
      candidates.add(fenced)
    }

    const firstObjectStart = trimmed.indexOf('{')
    const lastObjectEnd = trimmed.lastIndexOf('}')
    if (firstObjectStart >= 0 && lastObjectEnd > firstObjectStart) {
      candidates.add(trimmed.slice(firstObjectStart, lastObjectEnd + 1))
    }

    const firstArrayStart = trimmed.indexOf('[')
    const lastArrayEnd = trimmed.lastIndexOf(']')
    if (firstArrayStart >= 0 && lastArrayEnd > firstArrayStart) {
      candidates.add(trimmed.slice(firstArrayStart, lastArrayEnd + 1))
    }

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as T
      } catch {
        continue
      }
    }

    throw new Error('No valid JSON payload found in AI response')
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
        ...(params.signal && { signal: params.signal }),
      })

      let fullContent = ''
      let usage: AiResponse['usage'] | undefined

      for await (const chunk of stream) {
        // Check if request was aborted
        if (params.signal?.aborted) {
          logger.info({ model: config.model }, 'AI stream aborted by client')
          return
        }

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
    const startedAt = Date.now()
    const timeoutMs = AI.DEFAULT_TIMEOUT

    logger.debug(
      {
        model: config.model,
        baseUrl: config.baseUrl,
        timeoutMs,
        maxRetries: config.maxRetries ?? AI.DEFAULT_MAX_RETRIES,
        messageCount: params.messages.length,
        inputChars: params.messages.reduce((sum, item) => sum + item.content.length, 0),
        maxTokens: params.maxTokens,
        temperature: params.temperature ?? 0.7,
        hasResponseFormat: Boolean(params.responseFormat),
        stream,
      },
      'AI chat request started'
    )

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
      const elapsedMs = Date.now() - startedAt

      logger.info(
        { model: config.model, tokens: usage.totalTokens, elapsedMs, timeoutMs },
        'AI chat completed'
      )

      return { content, usage }
    } catch (error) {
      const elapsedMs = Date.now() - startedAt
      const handledError = this.handleError(error)
      logger.error(
        {
          model: config.model,
          baseUrl: config.baseUrl,
          timeoutMs,
          elapsedMs,
          errorCode: handledError.code,
          errorName: handledError.name,
          errorMessage: handledError.message,
        },
        'AI chat failed'
      )
      throw handledError
    }
  }

  private getClient(config: AiClientConfig): OpenAI {
    return new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      timeout: AI.DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? AI.DEFAULT_MAX_RETRIES,
    })
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

  private parseUsage(usage: unknown): AiResponse['usage'] {
    const payload =
      usage && typeof usage === 'object'
        ? (usage as {
            prompt_tokens?: number
            completion_tokens?: number
            total_tokens?: number
          })
        : {}

    return {
      promptTokens: payload.prompt_tokens ?? 0,
      completionTokens: payload.completion_tokens ?? 0,
      totalTokens: payload.total_tokens ?? 0,
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

  private createChunks<TChunkItem>(
    items: TChunkItem[],
    maxChunkChars: number,
    maxChunkItems: number,
    getItemChars: (item: TChunkItem) => number
  ): TChunkItem[][] {
    const chunks: TChunkItem[][] = []
    let currentChunk: TChunkItem[] = []
    let currentChars = 0

    for (const item of items) {
      const itemChars = Math.max(1, getItemChars(item))
      const shouldFlush =
        currentChunk.length > 0 &&
        (currentChunk.length >= maxChunkItems || currentChars + itemChars > maxChunkChars)

      if (shouldFlush) {
        chunks.push(currentChunk)
        currentChunk = []
        currentChars = 0
      }

      currentChunk.push(item)
      currentChars += itemChars
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
    }

    return chunks
  }
}
