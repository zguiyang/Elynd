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
      INSERT INTO book_levels (id, code, name, description, min_words, max_words, sort_order, is_active, created_at, updated_at)
      VALUES
        (1, 'L1', 'Beginner', '0-800', 0, 800, 1, true, NOW(), NOW()),
        (2, 'L2', 'Elementary', '801-1500', 801, 1500, 2, true, NOW(), NOW()),
        (3, 'L3', 'Intermediate', '1501-3000', 1501, 3000, 3, true, NOW(), NOW()),
        (4, 'L4', 'Advanced', '3001', 3001, NULL, 4, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        min_words = EXCLUDED.min_words,
        max_words = EXCLUDED.max_words,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `)

    await db.rawQuery(`
      UPDATE books b
      SET
        level_id = CASE
          WHEN COALESCE(v.unique_lemma_count, 0) <= 800 THEN 1
          WHEN COALESCE(v.unique_lemma_count, 0) <= 1500 THEN 2
          WHEN COALESCE(v.unique_lemma_count, 0) <= 3000 THEN 3
          ELSE 4
        END,
        level_classified_by = 'rule',
        level_classified_at = NOW()
      FROM (
        SELECT books.id AS book_id, COUNT(DISTINCT bv.lemma) AS unique_lemma_count
        FROM books
        LEFT JOIN book_vocabularies bv ON bv.book_id = books.id
        GROUP BY books.id
      ) v
      WHERE b.id = v.book_id
    `)

    await db.rawQuery(`
      UPDATE book_levels
      SET is_active = false, updated_at = NOW()
      WHERE id NOT IN (1, 2, 3, 4)
    `)
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      return
    }

    await db.rawQuery(`
      INSERT INTO book_levels (id, code, name, description, min_words, max_words, sort_order, is_active, created_at, updated_at)
      VALUES
        (1, 'L1', 'Beginner', '0-500', 0, 500, 1, true, NOW(), NOW()),
        (2, 'L2', 'Elementary', '500-1000', 500, 1000, 2, true, NOW(), NOW()),
        (3, 'L3', 'Intermediate', '1000-2000', 1000, 2000, 3, true, NOW(), NOW()),
        (4, 'L4', 'Advanced', '2000', 2000, NULL, 4, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        min_words = EXCLUDED.min_words,
        max_words = EXCLUDED.max_words,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `)
  }
}
