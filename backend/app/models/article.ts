import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import { type ManyToMany, type BelongsTo, type HasMany } from '@adonisjs/lucid/types/relations'
import Tag from '#models/tag'
import User from '#models/user'
import ArticleVocabulary from '#models/article_vocabulary'
import ArticleChapter from '#models/article_chapter'

export default class Article extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare difficultyLevel: string

  @column()
  declare wordCount: number

  @column()
  declare readingTime: number

  @column()
  declare isPublished: boolean

  @column()
  declare createdBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare author: BelongsTo<typeof User>

  @manyToMany(() => Tag, { pivotTable: 'article_tags', pivotTimestamps: true })
  declare tags: ManyToMany<typeof Tag>

  @hasMany(() => ArticleVocabulary)
  declare vocabularies: HasMany<typeof ArticleVocabulary>

  @hasMany(() => ArticleChapter)
  declare chapters: HasMany<typeof ArticleChapter>
}
