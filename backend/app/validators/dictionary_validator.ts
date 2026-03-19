import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'
import { DICTIONARY } from '#constants'

export const dictionaryLookupValidator = vine.compile(
  vine.object({
    word: vine
      .string()
      .trim()
      .minLength(1)
      .maxLength(DICTIONARY.WORD_MAX_LENGTH)
      .regex(/^[a-zA-Z][a-zA-Z'-]*$/),
  })
)

export type DictionaryLookupValidator = Infer<typeof dictionaryLookupValidator>
