import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import { type BelongsTo } from '@adonisjs/lucid/types/relations'
import Book from '#models/book'
import BookProcessingRunLog from '#models/book_processing_run_log'

export type StepStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped'

export default class BookProcessingStepLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'run_log_id' })
  declare runLogId: number

  @column()
  declare bookId: number

  @column()
  declare stepKey: string

  @column()
  declare itemKey: string | null

  @column({ columnName: 'input_hash' })
  declare inputHash: string | null

  @column()
  declare status: StepStatus

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare finishedAt: DateTime | null

  @column({ columnName: 'duration_ms' })
  declare durationMs: number | null

  @column({ columnName: 'error_code' })
  declare errorCode: string | null

  @column({ columnName: 'error_message' })
  declare errorMessage: string | null

  @column({ columnName: 'output_ref' })
  declare outputRef: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Book, { foreignKey: 'bookId' })
  declare book: BelongsTo<typeof Book>

  @belongsTo(() => BookProcessingRunLog, { foreignKey: 'runLogId' })
  declare runLog: BelongsTo<typeof BookProcessingRunLog>
}
