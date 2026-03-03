import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'article_chats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().notNullable()
      table.integer('article_id').unsigned().notNullable()
      table.string('role').notNullable().comment('user or assistant')
      table.text('content').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['user_id', 'article_id'])
      table.foreign('user_id').references('users.id').onDelete('CASCADE')
      table.foreign('article_id').references('articles.id').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
