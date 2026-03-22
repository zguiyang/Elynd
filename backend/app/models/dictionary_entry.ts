import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import BookVocabulary from '#models/book_vocabulary'

const parseJsonColumn = <T>(value: unknown, fallback: T): T => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  return (value as T) ?? fallback
}

const stringifyJsonColumn = (value: unknown) => JSON.stringify(value ?? [])

export default class DictionaryEntry extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare word: string

  @column()
  declare localizationLanguage: string

  @column()
  declare sourceLanguage: string

  @column()
  declare phonetic: string | null

  @column({
    prepare: stringifyJsonColumn,
    consume: (value) =>
      parseJsonColumn<
        Array<{
          partOfSpeech: string
          localizedMeaning: string
          explanation: string
          examples: Array<{
            sourceText: string
            localizedText: string
            source: 'dictionary' | 'article' | 'ai'
          }>
        }>
      >(value, []),
  })
  declare meanings: Array<{
    partOfSpeech: string
    localizedMeaning: string
    explanation: string
    examples: Array<{
      sourceText: string
      localizedText: string
      source: 'dictionary' | 'article' | 'ai'
    }>
  }>

  @column()
  declare metaSource: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => BookVocabulary)
  declare bookVocabularies: HasMany<typeof BookVocabulary>
}
