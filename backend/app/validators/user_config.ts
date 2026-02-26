import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

export const updateUserConfigValidator = vine.compile(
  vine.object({
    nativeLanguage: vine.string().maxLength(50).optional(),
    targetLanguage: vine.string().maxLength(50).optional(),
    vocabularyLevel: vine.string().maxLength(20).optional(),
    learningInitCompleted: vine.boolean().optional(),
  })
)

export type UpdateUserConfigData = Infer<typeof updateUserConfigValidator>
