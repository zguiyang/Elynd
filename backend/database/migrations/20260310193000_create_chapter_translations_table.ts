import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chapter_translations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table
        .integer('chapter_id')
        .unsigned()
        .references('book_chapters.id')
        .onDelete('CASCADE')
        .notNullable()

      table.string('source_language', 32).notNullable()
      table.string('target_language', 32).notNullable()
      table.string('content_hash', 64).notNullable()
      table.string('status', 20).notNullable().defaultTo('queued')

      table.string('provider', 32).nullable()
      table.string('model', 64).nullable()
      table.string('prompt_version', 32).notNullable().defaultTo('v1')

      table.jsonb('result_json').nullable()
      table.text('error_message').nullable()

      table.string('alignment_version', 32).nullable()
      table.jsonb('metadata').nullable()

      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('users.id')
        .onDelete('SET NULL')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(
        ['chapter_id', 'source_language', 'target_language', 'content_hash', 'prompt_version'],
        {
          indexName: 'chapter_translations_identity_unique',
        }
      )

      table.index(
        ['chapter_id', 'source_language', 'target_language', 'status'],
        'chapter_translations_lookup_idx'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
