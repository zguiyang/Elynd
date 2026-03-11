import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import { type BelongsTo, type HasMany } from '@adonisjs/lucid/types/relations'
import Book from '#models/book'
import BookProcessingStepLog from '#models/book_processing_step_log'

export type JobType = 'import' | 'retry_audio'
export type RunStatus = 'processing' | 'success' | 'failed'

export default class BookProcessingRunLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bookId: number

  @column()
  declare jobType: JobType

  @column()
  declare status: RunStatus

  @column()
  declare currentStep: string | null

  @column()
  declare progress: number

  @column.dateTime()
  declare startedAt: DateTime

  @column.dateTime()
  declare finishedAt: DateTime | null

  @column()
  declare durationMs: number | null

  @column()
  declare errorCode: string | null

  @column()
  declare errorMessage: string | null

  @column({ columnName: 'metadata' })
  declare metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Book, { foreignKey: 'bookId' })
  declare book: BelongsTo<typeof Book>

  @hasMany(() => BookProcessingStepLog, { foreignKey: 'runLogId' })
  declare steps: HasMany<typeof BookProcessingStepLog>
}
