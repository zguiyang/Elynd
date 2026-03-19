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
      SET description = CASE id
        WHEN 1 THEN '0-500'
        WHEN 2 THEN '500-1000'
        WHEN 3 THEN '1000-2000'
        WHEN 4 THEN '2000'
        ELSE description
      END,
      updated_at = NOW()
      WHERE id IN (1, 2, 3, 4)
    `)
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      return
    }

    await db.rawQuery(`
      UPDATE book_levels
      SET description = CASE id
        WHEN 1 THEN '0-500 words'
        WHEN 2 THEN '500-1000 words'
        WHEN 3 THEN '1000-2000 words'
        WHEN 4 THEN '2000+ words'
        ELSE description
      END,
      updated_at = NOW()
      WHERE id IN (1, 2, 3, 4)
    `)
  }
}
