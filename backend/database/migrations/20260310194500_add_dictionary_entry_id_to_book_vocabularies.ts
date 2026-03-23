import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'book_vocabularies'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      return
    }

    const hasDictionaryEntryId = await this.schema.hasColumn(this.tableName, 'dictionary_entry_id')

    if (!hasDictionaryEntryId) {
      this.schema.alterTable(this.tableName, (table) => {
        table
          .bigInteger('dictionary_entry_id')
          .unsigned()
          .nullable()
          .references('dictionary_entries.id')
          .onDelete('SET NULL')
        table.index(['dictionary_entry_id'], 'book_vocabularies_dictionary_entry_id_idx')
      })
    }

    this.schema.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS book_vocabularies_book_word_unique
      ON book_vocabularies (book_id, LOWER(word))
    `)
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      return
    }

    this.schema.raw('DROP INDEX IF EXISTS book_vocabularies_book_word_unique')

    const hasDictionaryEntryId = await this.schema.hasColumn(this.tableName, 'dictionary_entry_id')
    if (hasDictionaryEntryId) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropIndex(['dictionary_entry_id'], 'book_vocabularies_dictionary_entry_id_idx')
        table.dropColumn('dictionary_entry_id')
      })
    }
  }
}
