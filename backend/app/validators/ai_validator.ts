import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

export const articleChatValidator = vine.compile(
  vine.object({
    message: vine.string().trim().minLength(1),
    articleTitle: vine.string().trim().optional(),
    chapterContent: vine.string().trim().optional(),
  })
)

export type ArticleChatValidator = Infer<typeof articleChatValidator>
