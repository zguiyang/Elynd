import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'book_chapter_audios'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('timing_words').nullable()
      table.integer('chunk_count').nullable()
      table.string('error_code', 64).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('timing_words')
      table.dropColumn('chunk_count')
      table.dropColumn('error_code')
    })
  }
}
