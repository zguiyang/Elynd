import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import { type ManyToMany, type BelongsTo, type HasMany } from '@adonisjs/lucid/types/relations'
import Tag from '#models/tag'
import User from '#models/user'
import ArticleVocabulary from '#models/article_vocabulary'

export default class Article extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare content: string

  @column()
  declare difficultyLevel: string

  @column()
  declare wordCount: number | null

  @column()
  declare readingTime: number | null

  @column({ serializeAs: null })
  declare tableOfContents: string[] | null

  @column()
  declare chapterCount: number | null

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
}
