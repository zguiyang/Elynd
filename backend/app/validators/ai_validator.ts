import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

export const chatValidator = vine.compile(
  vine.object({
    messages: vine
      .array(
        vine.object({
          role: vine.string().trim(),
          content: vine.string().trim(),
          name: vine.string().trim().optional(),
        })
      )
      .minLength(1),
    model: vine.string().trim().minLength(1),
    tools: vine
      .array(
        vine.object({
          type: vine.literal('function'),
          function: vine.object({
            name: vine.string().trim(),
            description: vine.string().trim().optional(),
            parameters: vine
              .object({
                type: vine.literal('object'),
                properties: vine.object({}),
                required: vine.array(vine.string()).optional(),
              })
              .optional(),
          }),
        })
      )
      .optional(),
    stream: vine.boolean().optional(),
    temperature: vine.number().min(0).max(2).optional(),
    max_tokens: vine.number().min(1).optional(),
    top_p: vine.number().min(0).max(1).optional(),
    frequency_penalty: vine.number().min(-2).max(2).optional(),
    presence_penalty: vine.number().min(-2).max(2).optional(),
    response_format: vine
      .object({
        type: vine.enum(['json_object', 'text']),
      })
      .optional(),
  })
)

export type ChatValidator = Infer<typeof chatValidator>

export const articleChatValidator = vine.compile(
  vine.object({
    message: vine.string().trim().minLength(1),
    articleTitle: vine.string().trim().optional(),
    chapterContent: vine.string().trim().optional(),
  })
)

export type ArticleChatValidator = Infer<typeof articleChatValidator>
