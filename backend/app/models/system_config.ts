import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class SystemConfig extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare aiBaseUrl: string | null

  @column()
  declare aiApiKey: string | null

  @column()
  declare aiModelName: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
