import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Book from '#models/book'

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
  declare meaning: string

  @column()
  declare sentence: string

  @column()
  declare phonetic: string | null

  @column()
  declare phoneticText: string | null

  @column()
  declare phoneticAudio: string | null

  @column()
  declare details: any | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Book)
  declare book: BelongsTo<typeof Book>
}
