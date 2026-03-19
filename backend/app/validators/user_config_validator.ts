import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'
import { ENGLISH_VARIANT, VOCABULARY_LEVEL, LANGUAGE } from '#constants'

export const updateUserConfigValidator = vine.compile(
  vine.object({
    nativeLanguage: vine.enum(Object.values(LANGUAGE)).optional(),
    targetLanguage: vine.enum(Object.values(LANGUAGE)).optional(),
    vocabularyLevel: vine.enum(Object.values(VOCABULARY_LEVEL)).optional(),
    englishVariant: vine.enum([ENGLISH_VARIANT.US, ENGLISH_VARIANT.GB]).optional(),
    learningInitCompleted: vine.boolean().optional(),
  })
)

export type UpdateUserConfigData = Infer<typeof updateUserConfigValidator>
