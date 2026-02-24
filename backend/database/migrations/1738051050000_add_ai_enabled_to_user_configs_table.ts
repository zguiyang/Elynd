import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_configs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('ai_enabled').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ai_enabled')
    })
  }
}
