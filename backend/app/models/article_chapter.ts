import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import { type BelongsTo } from '@adonisjs/lucid/types/relations'
import Article from '#models/article'

export default class ArticleChapter extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare articleId: number

  @column()
  declare chapterIndex: number

  @column()
  declare title: string

  @column()
  declare content: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Article, { foreignKey: 'articleId' })
  declare article: BelongsTo<typeof Article>
}
