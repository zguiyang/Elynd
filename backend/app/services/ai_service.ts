import { OpenAI } from 'openai'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import type {
  UserAiConfig,
  AiChatParams,
  AiChatResponse,
  AiStreamChunk,
  AiStreamHandler,
  AiChatResponseError,
  AiChatSuccessResponse,
} from '#types/ai'
import { AI } from '#constants'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

@inject()
export class AiService {
  private validateUserConfig(userConfig: UserAiConfig): AiChatResponseError | null {
    if (!userConfig.enabled) {
      return this.formatError('AI_DISABLED', 'AI feature is not enabled for this user')
    }

    if (!userConfig.apiKey) {
      return this.formatError('MISSING_API_KEY', 'AI API key is not configured')
    }

    if (!userConfig.baseUrl) {
      return this.formatError('MISSING_BASE_URL', 'AI base URL is not configured')
    }

    return null
  }

  private createClient(userConfig: UserAiConfig): OpenAI {
    return new OpenAI({
      baseURL: userConfig.baseUrl,
      apiKey: userConfig.apiKey,
      timeout: AI.DEFAULT_TIMEOUT,
      maxRetries: AI.DEFAULT_MAX_RETRIES,
    })
  }

  private buildChatCreateParams(params: AiChatParams, stream: boolean, includeUsage: boolean) {
    return {
      model: params.model,
      messages: params.messages as ChatCompletionMessageParam[],
      tools: params.tools as any,
      stream,
      stream_options: includeUsage ? { include_usage: true } : undefined,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      frequency_penalty: params.frequency_penalty,
      presence_penalty: params.presence_penalty,
      response_format: params.response_format as any,
      user: params.user,
    }
  }

  async chat(userConfig: UserAiConfig, params: AiChatParams): Promise<AiChatResponse> {
    const configError = this.validateUserConfig(userConfig)
    if (configError) return configError

    const client = this.createClient(userConfig)

    try {
      const response = (await client.chat.completions.create(
        this.buildChatCreateParams(params, params.stream ?? false, false) as any
      )) as any

      if (params.stream) {
        return {
          success: true,
          data: response,
        }
      }

      const data = response

      logger.info(
        'AI chat request completed: model=%s, tokens=%d',
        params.model,
        data.usage?.total_tokens ?? 0
      )

      return {
        success: true,
        data: {
          id: data.id,
          object: 'chat.completion',
          created: data.created,
          model: data.model,
          choices: data.choices.map((choice: any) => ({
            index: choice.index,
            message: {
              role: choice.message.role,
              content: choice.message.content,
              tool_calls: choice.message.tool_calls?.map((tc: any) => ({
                id: tc.id,
                type: tc.type,
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              })),
            },
            finish_reason: choice.finish_reason,
          })),
          usage: data.usage
            ? {
                prompt_tokens: data.usage.prompt_tokens,
                completion_tokens: data.usage.completion_tokens,
                total_tokens: data.usage.total_tokens,
              }
            : undefined,
        },
      }
    } catch (error: any) {
      logger.error({ err: error }, 'AI chat request failed')
      return this.formatOpenAiError(error)
    }
  }

  async streamChat(
    userConfig: UserAiConfig,
    params: AiChatParams,
    handler: AiStreamHandler
  ): Promise<void> {
    const configError = this.validateUserConfig(userConfig)
    if (configError) {
      handler.onError(configError)
      return
    }

    const client = this.createClient(userConfig)

    try {
      const stream = (await client.chat.completions.create({
        ...(this.buildChatCreateParams(params, true, true) as any),
      })) as any

      let lastChunk: any = null
      const fullContent: string[] = []
      const toolCallsMap: Record<number, any> = {}

      for await (const chunk of stream) {
        lastChunk = chunk
        const formattedChunk: AiStreamChunk = {
          id: chunk.id,
          object: 'chat.completion.chunk',
          created: chunk.created,
          model: chunk.model,
          choices: chunk.choices.map((choice: any) => {
            if (choice.delta?.content) {
              fullContent.push(choice.delta.content)
            }

            if (choice.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                if (!toolCallsMap[tc.index]) {
                  toolCallsMap[tc.index] = {
                    id: tc.id,
                    type: tc.type,
                    function: { name: '', arguments: '' },
                  }
                }
                if (tc.function?.name) {
                  toolCallsMap[tc.index].function.name += tc.function.name
                }
                if (tc.function?.arguments) {
                  toolCallsMap[tc.index].function.arguments += tc.function.arguments
                }
              }
            }

            return {
              index: choice.index,
              delta: {
                role: choice.delta.role,
                content: choice.delta.content,
                tool_calls: choice.delta.tool_calls?.map((tc: any) => ({
                  index: tc.index,
                  id: tc.id,
                  type: tc.type,
                  function: {
                    name: tc.function?.name,
                    arguments: tc.function?.arguments,
                  },
                })),
              },
              finish_reason: choice.finish_reason,
            }
          }),
        }

        handler.onChunk(formattedChunk)
      }

      if (lastChunk && handler.onComplete) {
        const toolCalls = Object.values(toolCallsMap).map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: tc.function,
        }))

        handler.onComplete({
          id: lastChunk.id,
          object: 'chat.completion',
          created: lastChunk.created,
          model: lastChunk.model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: fullContent.join(''),
                tool_calls: toolCalls.length > 0 ? (toolCalls as any) : undefined,
              },
              finish_reason: lastChunk.choices[0]?.finish_reason || 'stop',
            },
          ],
          usage: lastChunk.usage,
        })
      }

      logger.info('AI stream completed: model=%s', params.model)
    } catch (error: any) {
      logger.error({ err: error }, 'AI stream request failed')
      handler.onError(this.formatOpenAiError(error))
    }
  }

  async streamToSse(
    userConfig: UserAiConfig,
    params: AiChatParams,
    response: HttpContext['response']
  ): Promise<void> {
    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')

    let completeResponse: AiChatSuccessResponse | null = null
    let hasError = false

    const encoder = new TextEncoder()
    const sendEvent = (controller: ReadableStreamDefaultController, event: string, eventData: unknown) => {
      const message = `event: ${event}\ndata: ${JSON.stringify(eventData)}\n\n`
      controller.enqueue(encoder.encode(message))
    }

    const webStream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        try {
          await this.streamChat(userConfig, params, {
            onChunk: (chunk: AiStreamChunk) => {
              sendEvent(controller, 'chunk', chunk)
            },
            onComplete: (resp: AiChatSuccessResponse) => {
              completeResponse = resp
              sendEvent(controller, 'complete', resp)
            },
            onError: (error: AiChatResponseError) => {
              hasError = true
              sendEvent(controller, 'error', error)
            },
          })

          if (!hasError && completeResponse && completeResponse.usage) {
            sendEvent(controller, 'usage', completeResponse.usage)
          }
        } catch (error: any) {
          logger.error({ err: error }, 'SSE stream failed')
          if (!hasError) {
            sendEvent(controller, 'error', this.formatOpenAiError(error))
          }
        } finally {
          controller.close()
        }
      },
    })

    const nodeReadable = Readable.fromWeb(webStream as unknown as NodeReadableStream)
    return response.stream(nodeReadable)
  }

  private formatOpenAiError(error: any): AiChatResponseError {
    if (error.status === 401) {
      return this.formatError('INVALID_API_KEY', 'Invalid AI API key', 'authentication_error')
    }

    if (error.status === 429) {
      return this.formatError(
        'RATE_LIMIT',
        'AI service rate limit exceeded. Please try again later.',
        'rate_limit'
      )
    }

    if (error.status === 404) {
      return this.formatError('MODEL_NOT_FOUND', `AI model not found: ${error.message}`, 'invalid_request_error')
    }

    if (error.status) {
      return this.formatError(
        `HTTP_${error.status}`,
        error.message || 'AI API request failed',
        error.type,
        error.param
      )
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return this.formatError('NETWORK_ERROR', `Unable to connect to AI service: ${error.message}`)
    }

    return this.formatError('UNKNOWN_ERROR', error.message || 'An unexpected error occurred')
  }

  private formatError(
    code: string,
    message: string,
    type?: string,
    param?: string
  ): AiChatResponseError {
    return {
      success: false,
      error: {
        code,
        message,
        type,
        param,
      },
    }
  }
}
