import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'book_chapter_audios'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS timing_words jsonb NULL`
      )
      await db.rawQuery(
        `ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS chunk_count integer NULL`
      )
      await db.rawQuery(
        `ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS error_code varchar(64) NULL`
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE ${this.tableName} DROP COLUMN IF EXISTS timing_words`)
      await db.rawQuery(`ALTER TABLE ${this.tableName} DROP COLUMN IF EXISTS chunk_count`)
      await db.rawQuery(`ALTER TABLE ${this.tableName} DROP COLUMN IF EXISTS error_code`)
    })
  }
}
