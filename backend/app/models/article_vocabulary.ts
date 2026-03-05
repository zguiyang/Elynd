import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Article from '#models/article'

export default class ArticleVocabulary extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare articleId: number

  @column()
  declare word: string

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

  @belongsTo(() => Article)
  declare article: BelongsTo<typeof Article>
}
