import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateArticleVocabulariesTable extends BaseSchema {
  protected tableName = 'article_vocabularies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('article_id')
        .unsigned()
        .references('articles.id')
        .onDelete('CASCADE')
        .notNullable()
      table.string('word', 100).notNullable()
      table.string('meaning', 500).notNullable()
      table.text('sentence').notNullable()
      table.string('phonetic', 100).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['article_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
