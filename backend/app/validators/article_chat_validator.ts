import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'
import { VALIDATION } from '#constants'

export const articleChatValidator = vine.compile(
  vine.object({
    message: vine
      .string()
      .trim()
      .minLength(VALIDATION.MESSAGE_MIN)
      .maxLength(VALIDATION.MESSAGE_MAX),
    chapterIndex: vine.number().optional(),
  })
)

export type ArticleChatValidator = Infer<typeof articleChatValidator>
