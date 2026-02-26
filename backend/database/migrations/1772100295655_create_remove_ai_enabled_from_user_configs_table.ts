import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_configs'

  async up() {
    this.schema.table(this.tableName, (table) => {
      table.dropColumn('ai_enabled')
    })
  }

  async down() {
    this.schema.table(this.tableName, (table) => {
      table.boolean('ai_enabled').defaultTo(true).notNullable()
    })
  }
}
