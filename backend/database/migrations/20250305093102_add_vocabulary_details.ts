import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddVocabularyDetails extends BaseSchema {
  protected tableName = 'article_vocabularies'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('phonetic_text', 100).nullable().after('phonetic')
      table.string('phonetic_audio', 500).nullable().after('phonetic_text')
      table.jsonb('details').nullable().after('phonetic_audio')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('phonetic_text')
      table.dropColumn('phonetic_audio')
      table.dropColumn('details')
    })
  }
}
