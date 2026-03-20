import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'dictionary_entries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table.string('word', 100).notNullable()
      table.string('localization_language', 20).notNullable().defaultTo('zh-CN')
      table.string('source_language', 20).notNullable().defaultTo('en')
      table.string('phonetic', 100).nullable()
      table.jsonb('phonetics').notNullable().defaultTo('[]')
      table.jsonb('meanings').notNullable()
      table.jsonb('article_examples').notNullable().defaultTo('[]')
      table.string('meta_source', 50).notNullable().defaultTo('dictionary')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['updated_at'], 'dictionary_entries_updated_at_idx')
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX dictionary_entries_word_lang_unique
      ON dictionary_entries (LOWER(word), localization_language)
    `)
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS dictionary_entries_word_lang_unique')
    this.schema.dropTable(this.tableName)
  }
}
