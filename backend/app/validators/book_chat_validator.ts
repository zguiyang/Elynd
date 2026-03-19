import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'
import { VALIDATION } from '#constants'

export const bookChatValidator = vine.compile(
  vine.object({
    message: vine
      .string()
      .trim()
      .minLength(VALIDATION.MESSAGE_MIN)
      .maxLength(VALIDATION.MESSAGE_MAX),
    chapterIndex: vine.number().optional(),
  })
)

export type BookChatValidator = Infer<typeof bookChatValidator>
