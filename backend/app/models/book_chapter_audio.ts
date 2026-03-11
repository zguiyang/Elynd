import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import { type BelongsTo } from '@adonisjs/lucid/types/relations'
import Book from '#models/book'

export type ChapterAudioStatus = 'pending' | 'processing' | 'completed' | 'failed'

export default class BookChapterAudio extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bookId: number

  @column({ columnName: 'chapter_index' })
  declare chapterIndex: number

  @column({ columnName: 'text_hash' })
  declare textHash: string

  @column({ columnName: 'voice_hash' })
  declare voiceHash: string

  @column({ columnName: 'audio_path' })
  declare audioPath: string | null

  @column({ columnName: 'duration_ms' })
  declare durationMs: number | null

  @column()
  declare status: ChapterAudioStatus

  @column({ columnName: 'error_message' })
  declare errorMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Book, { foreignKey: 'bookId' })
  declare book: BelongsTo<typeof Book>
}
