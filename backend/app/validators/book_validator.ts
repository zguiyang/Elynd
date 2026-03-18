import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'
import { ARTICLE_DIFFICULTY } from '#constants'

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
    source: vine.enum(['user_uploaded', 'public_domain']),
    bookHash: vine.string().trim().minLength(1).maxLength(128),
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
    source: vine.enum(['user_uploaded', 'public_domain']).optional(),
  })
)

export type ListBookValidator = Infer<typeof listBookValidator>
export type ImportBookValidator = Infer<typeof importBookValidator>
export type QueryBookStatusValidator = Infer<typeof queryBookStatusValidator>
export type AdminListBooksValidator = Infer<typeof adminListBooksValidator>
export type AdminBookIdValidator = Infer<typeof adminBookIdValidator>
export type AdminUpdateBookValidator = Infer<typeof adminUpdateBookValidator>
