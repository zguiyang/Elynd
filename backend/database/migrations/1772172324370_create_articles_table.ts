import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'articles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('title', 200).notNullable()
      table.text('content').notNullable()
      table.string('difficulty_level', 20).notNullable()
      table.integer('word_count')
      table.integer('reading_time')
      table.boolean('is_published').defaultTo(true).notNullable()
      table.integer('created_by').unsigned().references('users.id').onDelete('CASCADE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.check('length(content) <= ?', [100000])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
