import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_configs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('ai_model_name', 100).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ai_model_name')
    })
  }
}
