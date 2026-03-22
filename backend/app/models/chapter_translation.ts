import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BookChapter from '#models/book_chapter'
import User from '#models/user'
import type {
  ChapterTranslationResult,
  ChapterTranslationStatus,
  ChapterTranslationMetadata,
} from '#types/chapter_translation'

export default class ChapterTranslation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare chapterId: number

  @column()
  declare sourceLanguage: string

  @column()
  declare targetLanguage: string

  @column()
  declare contentHash: string

  @column()
  declare status: ChapterTranslationStatus

  @column()
  declare provider: string | null

  @column()
  declare model: string | null

  @column({ columnName: 'result_json' })
  declare resultJson: ChapterTranslationResult | null

  @column()
  declare errorMessage: string | null

  @column()
  declare metadata: ChapterTranslationMetadata | null

  @column()
  declare createdByUserId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => BookChapter, { foreignKey: 'chapterId' })
  declare chapter: BelongsTo<typeof BookChapter>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare creator: BelongsTo<typeof User>
}
