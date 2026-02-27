import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'
import { ARTICLE_DIFFICULTY } from '#constants'

export const generateArticleValidator = vine.compile(
  vine.object({
    difficultyLevel: vine.enum([
      ARTICLE_DIFFICULTY.L1,
      ARTICLE_DIFFICULTY.L2,
      ARTICLE_DIFFICULTY.L3,
    ]),
    topic: vine.string().trim().minLength(5).maxLength(200),
  })
)

export const listArticleValidator = vine.compile(
  vine.object({
    difficulty: vine
      .enum([ARTICLE_DIFFICULTY.L1, ARTICLE_DIFFICULTY.L2, ARTICLE_DIFFICULTY.L3])
      .optional(),
    tagId: vine.number().optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)

export type GenerateArticleValidator = Infer<typeof generateArticleValidator>
export type ListArticleValidator = Infer<typeof listArticleValidator>
