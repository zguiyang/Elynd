import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_configs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').notNullable().unique()
      table.string('ai_base_url', 500).nullable()
      table.text('ai_api_key').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.foreign('user_id').references('users.id').onDelete('cascade')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
