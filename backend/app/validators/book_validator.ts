import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'
import { ARTICLE_DIFFICULTY } from '#constants'

export const generateBookValidator = vine.compile(
  vine.object({
    difficultyLevel: vine.enum([
      ARTICLE_DIFFICULTY.L1,
      ARTICLE_DIFFICULTY.L2,
      ARTICLE_DIFFICULTY.L3,
    ]),
    topic: vine.string().trim().minLength(5).maxLength(200),
    extraInstructions: vine.string().trim().maxLength(500).optional(),
  })
)

export const listBookValidator = vine.compile(
  vine.object({
    difficulty: vine
      .enum([ARTICLE_DIFFICULTY.L1, ARTICLE_DIFFICULTY.L2, ARTICLE_DIFFICULTY.L3])
      .optional(),
    tagId: vine.number().optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)

export const importBookValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(200),
    author: vine.string().trim().maxLength(200).optional(),
    description: vine.string().trim().maxLength(2000).optional(),
    source: vine.enum(['user_uploaded', 'public_domain', 'ai_generated']),
    difficultyLevel: vine.enum([
      ARTICLE_DIFFICULTY.L1,
      ARTICLE_DIFFICULTY.L2,
      ARTICLE_DIFFICULTY.L3,
    ]),
    wordCount: vine.number().min(1),
    bookHash: vine.string().trim().minLength(1).maxLength(128),
    chapters: vine.array(
      vine.object({
        title: vine.string().trim().minLength(1).maxLength(200),
        content: vine.string().trim().minLength(1),
      })
    ),
  })
)

export const queryBookStatusValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
  })
)

export const adminListBooksValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)

export const adminBookIdValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
  })
)

export const adminUpdateBookValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(200).optional(),
    author: vine.string().trim().maxLength(200).nullable().optional(),
    description: vine.string().trim().maxLength(2000).optional(),
    difficultyLevel: vine
      .enum([ARTICLE_DIFFICULTY.L1, ARTICLE_DIFFICULTY.L2, ARTICLE_DIFFICULTY.L3])
      .optional(),
    source: vine.enum(['user_uploaded', 'public_domain', 'ai_generated']).optional(),
  })
)

export type GenerateBookValidator = Infer<typeof generateBookValidator>
export type ListBookValidator = Infer<typeof listBookValidator>
export type ImportBookValidator = Infer<typeof importBookValidator>
export type QueryBookStatusValidator = Infer<typeof queryBookStatusValidator>
export type AdminListBooksValidator = Infer<typeof adminListBooksValidator>
export type AdminBookIdValidator = Infer<typeof adminBookIdValidator>
export type AdminUpdateBookValidator = Infer<typeof adminUpdateBookValidator>
