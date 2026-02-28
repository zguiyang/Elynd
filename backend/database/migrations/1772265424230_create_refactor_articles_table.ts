import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'articles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('content')
      table.dropColumn('table_of_contents')
      table.dropColumn('chapter_count')
      table.integer('word_count').notNullable().alter()
      table.integer('reading_time').notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('content').notNullable()
      table.json('table_of_contents').nullable()
      table.integer('chapter_count').nullable()
      table.integer('word_count').alter()
      table.integer('reading_time').alter()
    })
  }
}
