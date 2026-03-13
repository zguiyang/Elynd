import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'books'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('raw_file_path', 500).nullable()
      table.string('raw_file_name', 255).nullable()
      table.string('raw_file_ext', 20).nullable()
      table.bigInteger('raw_file_size').nullable()
      table.string('raw_file_hash', 64).nullable()
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['raw_file_path'], {
        indexName: 'books_raw_file_path_unique',
      })
      table.index(['raw_file_hash'], 'books_raw_file_hash_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['raw_file_path'], 'books_raw_file_path_unique')
      table.dropIndex(['raw_file_hash'], 'books_raw_file_hash_idx')
      table.dropColumns(
        'raw_file_path',
        'raw_file_name',
        'raw_file_ext',
        'raw_file_size',
        'raw_file_hash'
      )
    })
  }
}
