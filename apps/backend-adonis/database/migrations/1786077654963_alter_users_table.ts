import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
  protected tableName = 'users';

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('username', 50).notNullable().unique();
      table.timestamp('email_verified_at', { useTz: true }).nullable();
      table.string('role', 32).notNullable().defaultTo('user');
      table.string('image', 512).nullable();
    });
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('username');
      table.dropColumn('email_verified_at');
      table.dropColumn('role');
      table.dropColumn('image');
    });
  }
}
