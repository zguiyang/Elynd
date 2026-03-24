import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chapter_translations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(
        ['chapter_id', 'source_language', 'target_language', 'content_hash', 'prompt_version'],
        'chapter_translations_identity_unique'
      )
      table.dropColumn('prompt_version')
      table.dropColumn('alignment_version')
      table.unique(
        ['chapter_id', 'source_language', 'target_language', 'content_hash'],
        'chapter_translations_identity_unique'
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(
        ['chapter_id', 'source_language', 'target_language', 'content_hash'],
        'chapter_translations_identity_unique'
      )
      table.string('prompt_version', 32).notNullable().defaultTo('v1')
      table.string('alignment_version', 32).nullable()
      table.unique(
        ['chapter_id', 'source_language', 'target_language', 'content_hash', 'prompt_version'],
        'chapter_translations_identity_unique'
      )
    })
  }
}
