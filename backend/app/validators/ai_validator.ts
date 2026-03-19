import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'

export const bookChatValidator = vine.compile(
  vine.object({
    message: vine.string().trim().minLength(1),
    bookTitle: vine.string().trim().optional(),
    chapterContent: vine.string().trim().optional(),
  })
)

export type BookChatValidator = Infer<typeof bookChatValidator>
