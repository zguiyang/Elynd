import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddEnglishVariantToUserConfigs extends BaseSchema {
  protected tableName = 'user_configs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('english_variant', 10).defaultTo('en-US')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('english_variant')
    })
  }
}
