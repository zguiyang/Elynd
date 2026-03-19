import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('book_levels', (table) => {
      table.increments('id').notNullable()
      table.string('code', 20).notNullable().unique()
      table.string('name', 100).notNullable()
      table.string('description', 200).notNullable()
      table.integer('min_words').nullable()
      table.integer('max_words').nullable()
      table.integer('sort_order').notNullable().unique()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })

    this.schema.alterTable('books', (table) => {
      table.integer('level_id').unsigned().nullable()
      table.string('level_classified_by', 20).notNullable().defaultTo('rule')
      table.timestamp('level_classified_at').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        INSERT INTO book_levels (id, code, name, description, min_words, max_words, sort_order, is_active, created_at, updated_at)
        VALUES
          (1, 'L1', 'Beginner', '0-500词', 0, 500, 1, true, NOW(), NOW()),
          (2, 'L2', 'Intermediate', '500-2000词', 500, 2000, 2, true, NOW(), NOW()),
          (3, 'L3', 'Advanced', '2000+词', 2000, NULL, 3, true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `)

      await db.rawQuery(`SELECT setval('book_levels_id_seq', (SELECT MAX(id) FROM book_levels))`)

      await db.rawQuery(`
        UPDATE books
        SET level_id = CASE
          WHEN LOWER(COALESCE(difficulty_level, '')) IN ('l1', 'beginner') THEN 1
          WHEN LOWER(COALESCE(difficulty_level, '')) IN ('l2', 'intermediate') THEN 2
          WHEN LOWER(COALESCE(difficulty_level, '')) IN ('l3', 'advanced') THEN 3
          ELSE 1
        END
      `)

      await db.rawQuery(
        `UPDATE books SET level_classified_at = NOW() WHERE level_classified_at IS NULL`
      )

      await db.rawQuery(`ALTER TABLE books ALTER COLUMN level_id SET NOT NULL`)
      await db.rawQuery(`
        ALTER TABLE books
        ADD CONSTRAINT books_level_id_foreign
        FOREIGN KEY (level_id) REFERENCES book_levels(id) ON DELETE RESTRICT
      `)
      await db.rawQuery(`ALTER TABLE books DROP COLUMN difficulty_level`)
    })
  }

  async down() {
    this.schema.alterTable('books', (table) => {
      table.string('difficulty_level', 20).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE books b
        SET difficulty_level = COALESCE(bl.code, 'L1')
        FROM book_levels bl
        WHERE bl.id = b.level_id
      `)

      await db.rawQuery(`UPDATE books SET difficulty_level = 'L1' WHERE difficulty_level IS NULL`)
      await db.rawQuery(`ALTER TABLE books ALTER COLUMN difficulty_level SET NOT NULL`)

      await db.rawQuery(`ALTER TABLE books DROP CONSTRAINT IF EXISTS books_level_id_foreign`)
      await db.rawQuery(`ALTER TABLE books DROP COLUMN IF EXISTS level_classified_at`)
      await db.rawQuery(`ALTER TABLE books DROP COLUMN IF EXISTS level_classified_by`)
      await db.rawQuery(`ALTER TABLE books DROP COLUMN IF EXISTS level_id`)
    })

    this.schema.dropTable('book_levels')
  }
}
