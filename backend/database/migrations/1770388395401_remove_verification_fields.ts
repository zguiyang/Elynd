import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('verification_token')
      table.dropColumn('verification_email_sent_at')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('verification_token').nullable()
      table.timestamp('verification_email_sent_at').nullable()
    })
  }
}
