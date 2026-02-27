import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, belongsTo } from '@adonisjs/lucid/orm'
import { type ManyToMany, type BelongsTo } from '@adonisjs/lucid/types/relations'
import Tag from '#models/tag'
import User from '#models/user'

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

  @manyToMany(() => Tag, { pivotTable: 'article_tags' })
  declare tags: ManyToMany<typeof Tag>
}
