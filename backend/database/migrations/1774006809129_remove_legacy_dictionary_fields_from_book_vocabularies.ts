import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'book_vocabularies'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('meaning')
      table.dropColumn('phonetic')
      table.dropColumn('phonetic_text')
      table.dropColumn('phonetic_audio')
      table.dropColumn('details')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('meaning', 500).notNullable().defaultTo('')
      table.string('phonetic', 100).nullable()
      table.string('phonetic_text', 100).nullable()
      table.string('phonetic_audio', 500).nullable()
      table.jsonb('details').nullable()
    })
  }
}
