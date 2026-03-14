import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'books'

  async up() {
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      DROP CONSTRAINT IF EXISTS books_status_check
    `)

    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT books_status_check
      CHECK (status IN ('processing', 'ready', 'failed', 'cancelled'))
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      DROP CONSTRAINT IF EXISTS books_status_check
    `)

    await this.db.rawQuery(`
      ALTER TABLE ${this.tableName}
      ADD CONSTRAINT books_status_check
      CHECK (status IN ('processing', 'ready', 'failed'))
    `)
  }
}
