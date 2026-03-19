import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  protected tableName = 'book_levels'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      return
    }

    await db.rawQuery(`
      UPDATE book_levels
      SET description = '2000', updated_at = NOW()
      WHERE id = 4
    `)
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      return
    }

    await db.rawQuery(`
      UPDATE book_levels
      SET description = '2000+', updated_at = NOW()
      WHERE id = 4
    `)
  }
}
