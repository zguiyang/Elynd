import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'article_tags'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('article_id').unsigned().references('articles.id').onDelete('CASCADE')
      table.integer('tag_id').unsigned().references('tags.id').onDelete('CASCADE')
      table.timestamp('created_at').notNullable()

      table.primary(['article_id', 'tag_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
