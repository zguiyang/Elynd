import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'article_chapters'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('article_id')
        .unsigned()
        .references('articles.id')
        .onDelete('CASCADE')
        .notNullable()
      table.integer('chapter_index').notNullable()
      table.string('title', 200).notNullable()
      table.text('content').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['article_id', 'chapter_index'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
