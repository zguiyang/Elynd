import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import { DICTIONARY } from '#constants'

export const wordAudioValidator = vine.compile(
  vine.object({
    word: vine.string().trim().minLength(1).maxLength(DICTIONARY.WORD_MAX_LENGTH),
  })
)

export type WordAudioValidator = Infer<typeof wordAudioValidator>
