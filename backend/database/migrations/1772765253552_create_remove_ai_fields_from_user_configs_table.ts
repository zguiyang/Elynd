import { BaseSchema } from '@adonisjs/lucid/schema'

export default class RemoveAiFieldsFromUserConfigs extends BaseSchema {
  protected tableName = 'user_configs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ai_base_url')
      table.dropColumn('ai_api_key')
      table.dropColumn('ai_model_name')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('ai_base_url', 500).nullable()
      table.string('ai_api_key', 500).nullable()
      table.string('ai_model_name', 100).nullable()
    })
  }
}
