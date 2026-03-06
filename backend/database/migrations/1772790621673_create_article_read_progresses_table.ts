import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'article_read_progresses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE')
      table.integer('article_id').unsigned().references('articles.id').onDelete('CASCADE')
      table.integer('progress').notNullable().defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['user_id', 'article_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
