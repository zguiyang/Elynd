import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_email_verified').defaultTo(false).after('email')
      table.dropColumn('email_verified_at')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_email_verified')
      table.timestamp('email_verified_at').nullable()
    })
  }
}
