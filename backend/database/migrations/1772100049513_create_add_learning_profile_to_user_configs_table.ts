import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_configs'

  async up() {
    this.schema.table(this.tableName, (table) => {
      table.string('native_language', 50).nullable()
      table.string('target_language', 50).nullable()
      table.string('vocabulary_level', 20).nullable()
      table.boolean('learning_init_completed').defaultTo(false)
    })
  }

  async down() {
    this.schema.table(this.tableName, (table) => {
      table.dropColumn('native_language')
      table.dropColumn('target_language')
      table.dropColumn('vocabulary_level')
      table.dropColumn('learning_init_completed')
    })
  }
}
