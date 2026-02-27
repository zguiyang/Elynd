import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'system_configs'

  public async up() {
    this.schema.dropTableIfExists(this.tableName)

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('ai_base_url').nullable()
      table.text('ai_api_key').nullable()
      table.text('ai_model_name').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('key', 255).notNullable().unique()
      table.text('value').nullable()
      table.string('description', 500).nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }
}
