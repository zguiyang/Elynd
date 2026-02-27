import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'article_tags'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('updated_at')
    })
  }
}
