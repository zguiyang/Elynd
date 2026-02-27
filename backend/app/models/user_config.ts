import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class UserConfig extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare aiBaseUrl: string | null

  @column()
  declare aiApiKey: string | null

  @column()
  declare aiModelName: string | null

  @column()
  declare nativeLanguage: string | null

  @column()
  declare targetLanguage: string | null

  @column()
  declare englishVariant: string | null

  @column()
  declare vocabularyLevel: string | null

  @column()
  declare learningInitCompleted: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
