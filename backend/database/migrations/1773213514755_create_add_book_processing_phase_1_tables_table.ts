import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: add_book_processing_phase1_tables
 *
 * Schema contract (test expectations):
 * - books.content_hash varchar(64), indexed
 * - book_processing_run_logs:
 *   - id, book_id FK, job_type enum (import, retry_audio)
 *   - status enum (processing, success, failed)
 *   - current_step, progress, started_at, finished_at, duration_ms
 *   - error_code, error_message, metadata (jsonb)
 * - book_processing_step_logs:
 *   - id, run_log_id FK, book_id FK
 *   - step_key, item_key nullable (e.g., chapter:3)
 *   - input_hash, status, started_at, finished_at, duration_ms
 *   - error_code, error_message, output_ref (jsonb)
 *   - composite index (book_id, step_key, item_key, input_hash)
 * - book_chapter_audios:
 *   - id, book_id FK
 *   - chapter_index, text_hash, voice_hash
 *   - audio_path, duration_ms, status, error_message, timestamps
 *   - unique (book_id, chapter_index, text_hash, voice_hash)
 */
export default class extends BaseSchema {
  protected tableName = 'book_processing'

  async up() {
    // Add content_hash to books table with index
    this.schema.alterTable('books', (table) => {
      table.string('content_hash', 64).nullable()
      table.index('content_hash', 'books_content_hash_idx')
    })

    // Create book_processing_run_logs table
    this.schema.createTable('book_processing_run_logs', (table) => {
      table.increments('id').notNullable()
      table
        .integer('book_id')
        .unsigned()
        .references('books.id')
        .onDelete('CASCADE')
        .notNullable()
      table.enum('job_type', ['import', 'retry_audio']).notNullable()
      table.enum('status', ['processing', 'success', 'failed']).notNullable()
      table.string('current_step', 100).nullable()
      table.integer('progress').notNullable().defaultTo(0)
      table.timestamp('started_at').notNullable()
      table.timestamp('finished_at').nullable()
      table.bigInteger('duration_ms').nullable()
      table.string('error_code', 50).nullable()
      table.text('error_message').nullable()
      table.jsonb('metadata').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['book_id'], 'run_logs_book_id_idx')
      table.index(['status'], 'run_logs_status_idx')
    })

    // Create book_processing_step_logs table
    this.schema.createTable('book_processing_step_logs', (table) => {
      table.increments('id').notNullable()
      table
        .integer('run_log_id')
        .unsigned()
        .references('book_processing_run_logs.id')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('book_id')
        .unsigned()
        .references('books.id')
        .onDelete('CASCADE')
        .notNullable()
      table.string('step_key', 100).notNullable()
      table.string('item_key', 100).nullable()
      table.string('input_hash', 64).nullable()
      table.enum('status', ['pending', 'processing', 'success', 'failed', 'skipped'])
        .notNullable()
        .defaultTo('pending')
      table.timestamp('started_at').nullable()
      table.timestamp('finished_at').nullable()
      table.bigInteger('duration_ms').nullable()
      table.string('error_code', 50).nullable()
      table.text('error_message').nullable()
      table.jsonb('output_ref').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(
        ['book_id', 'step_key', 'item_key', 'input_hash'],
        'step_logs_composite_idx'
      )
    })

    // Create book_chapter_audios table
    this.schema.createTable('book_chapter_audios', (table) => {
      table.increments('id').notNullable()
      table
        .integer('book_id')
        .unsigned()
        .references('books.id')
        .onDelete('CASCADE')
        .notNullable()
      table.integer('chapter_index').notNullable()
      table.string('text_hash', 64).notNullable()
      table.string('voice_hash', 64).notNullable()
      table.string('audio_path', 500).nullable()
      table.integer('duration_ms').nullable()
      table.enum('status', ['pending', 'processing', 'completed', 'failed']).notNullable()
        .defaultTo('pending')
      table.text('error_message').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['book_id', 'chapter_index', 'text_hash', 'voice_hash'])
      table.index(['book_id'], 'chapter_audios_book_id_idx')
      table.index(['status'], 'chapter_audios_status_idx')
    })
  }

  async down() {
    this.schema.dropTable('book_chapter_audios')
    this.schema.dropTable('book_processing_step_logs')
    this.schema.dropTable('book_processing_run_logs')

    this.schema.alterTable('books', (table) => {
      table.dropIndex('content_hash', 'books_content_hash_idx')
      table.dropColumn('content_hash')
    })
  }
}
