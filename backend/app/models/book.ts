import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { ManyToMany, BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { AudioStatus } from '#types/tts'
import Tag from '#models/tag'
import User from '#models/user'
import BookVocabulary from '#models/book_vocabulary'
import BookChapter from '#models/book_chapter'
import BookChat from '#models/book_chat'
import BookProcessingRunLog from '#models/book_processing_run_log'
import BookProcessingStepLog from '#models/book_processing_step_log'
import BookChapterAudio from '#models/book_chapter_audio'

export type VocabularyStatus = 'pending' | 'processing' | 'completed' | 'failed'

export default class Book extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare source: 'user_uploaded' | 'public_domain'

  @column()
  declare author: string | null

  @column()
  declare description: string | null

  @column()
  declare difficultyLevel: string

  @column()
  declare status: 'processing' | 'ready' | 'failed' | 'cancelled'

  @column()
  declare processingStep: string | null

  @column()
  declare processingProgress: number

  @column()
  declare processingError: string | null

  @column()
  declare wordCount: number

  @column()
  declare readingTime: number

  @column()
  declare isPublished: boolean

  @column({ columnName: 'content_hash' })
  declare contentHash: string | null

  @column({ columnName: 'book_hash' })
  declare bookHash: string | null

  @column({ columnName: 'raw_file_path' })
  declare rawFilePath: string | null

  @column({ columnName: 'raw_file_name' })
  declare rawFileName: string | null

  @column({ columnName: 'raw_file_ext' })
  declare rawFileExt: string | null

  @column({ columnName: 'raw_file_size' })
  declare rawFileSize: number | null

  @column({ columnName: 'raw_file_hash' })
  declare rawFileHash: string | null

  @column()
  declare createdBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare audioUrl: string | null

  @column()
  declare audioStatus: AudioStatus | null

  @column()
  declare audioTiming: Record<string, unknown> | null

  @column.dateTime()
  declare audioGeneratedAt: DateTime | null

  @column({ columnName: 'vocabulary_status' })
  declare vocabularyStatus: VocabularyStatus

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @manyToMany(() => Tag, { pivotTable: 'book_tags', pivotTimestamps: true })
  declare tags: ManyToMany<typeof Tag>

  @hasMany(() => BookVocabulary)
  declare vocabularies: HasMany<typeof BookVocabulary>

  @hasMany(() => BookChapter)
  declare chapters: HasMany<typeof BookChapter>

  @hasMany(() => BookChat)
  declare chats: HasMany<typeof BookChat>

  @hasMany(() => BookProcessingRunLog)
  declare processingRuns: HasMany<typeof BookProcessingRunLog>

  @hasMany(() => BookProcessingStepLog)
  declare processingSteps: HasMany<typeof BookProcessingStepLog>

  @hasMany(() => BookChapterAudio)
  declare chapterAudios: HasMany<typeof BookChapterAudio>
}
