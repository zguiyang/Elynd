import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'

export const triggerChapterTranslationValidator = vine.compile(
  vine.object({
    sourceLanguage: vine.string().trim().minLength(2).maxLength(32),
    targetLanguage: vine.string().trim().minLength(2).maxLength(32),
  })
)

export const queryChapterTranslationValidator = vine.compile(
  vine.object({
    sourceLanguage: vine.string().trim().minLength(2).maxLength(32),
    targetLanguage: vine.string().trim().minLength(2).maxLength(32),
  })
)

export type TriggerChapterTranslationValidator = Infer<typeof triggerChapterTranslationValidator>
export type QueryChapterTranslationValidator = Infer<typeof queryChapterTranslationValidator>
