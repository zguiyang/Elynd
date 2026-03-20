import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Book from '#models/book'
import DictionaryEntry from '#models/dictionary_entry'

export default class BookVocabulary extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bookId: number

  @column()
  declare word: string

  @column()
  declare lemma: string

  @column()
  declare frequency: number

  @column()
  declare sentence: string

  @column()
  declare dictionaryEntryId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Book)
  declare book: BelongsTo<typeof Book>

  @belongsTo(() => DictionaryEntry)
  declare dictionaryEntry: BelongsTo<typeof DictionaryEntry>
}
