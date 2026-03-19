import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Book from '#models/book'

export default class BookLevel extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string

  @column({ columnName: 'min_words' })
  declare minWords: number | null

  @column({ columnName: 'max_words' })
  declare maxWords: number | null

  @column({ columnName: 'sort_order' })
  declare sortOrder: number

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Book, { foreignKey: 'levelId' })
  declare books: HasMany<typeof Book>
}
