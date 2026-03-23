import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'book_vocabularies'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      return
    }

    const hasMeaning = await this.schema.hasColumn(this.tableName, 'meaning')
    const hasPhonetic = await this.schema.hasColumn(this.tableName, 'phonetic')
    const hasPhoneticText = await this.schema.hasColumn(this.tableName, 'phonetic_text')
    const hasPhoneticAudio = await this.schema.hasColumn(this.tableName, 'phonetic_audio')
    const hasDetails = await this.schema.hasColumn(this.tableName, 'details')

    if (hasMeaning || hasPhonetic || hasPhoneticText || hasPhoneticAudio || hasDetails) {
      this.schema.alterTable(this.tableName, (table) => {
        if (hasMeaning) {
          table.dropColumn('meaning')
        }
        if (hasPhonetic) {
          table.dropColumn('phonetic')
        }
        if (hasPhoneticText) {
          table.dropColumn('phonetic_text')
        }
        if (hasPhoneticAudio) {
          table.dropColumn('phonetic_audio')
        }
        if (hasDetails) {
          table.dropColumn('details')
        }
      })
    }
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) {
      return
    }

    const hasMeaning = await this.schema.hasColumn(this.tableName, 'meaning')
    const hasPhonetic = await this.schema.hasColumn(this.tableName, 'phonetic')
    const hasPhoneticText = await this.schema.hasColumn(this.tableName, 'phonetic_text')
    const hasPhoneticAudio = await this.schema.hasColumn(this.tableName, 'phonetic_audio')
    const hasDetails = await this.schema.hasColumn(this.tableName, 'details')

    if (!hasMeaning || !hasPhonetic || !hasPhoneticText || !hasPhoneticAudio || !hasDetails) {
      this.schema.alterTable(this.tableName, (table) => {
        if (!hasMeaning) {
          table.string('meaning', 500).notNullable().defaultTo('')
        }
        if (!hasPhonetic) {
          table.string('phonetic', 100).nullable()
        }
        if (!hasPhoneticText) {
          table.string('phonetic_text', 100).nullable()
        }
        if (!hasPhoneticAudio) {
          table.string('phonetic_audio', 500).nullable()
        }
        if (!hasDetails) {
          table.jsonb('details').nullable()
        }
      })
    }
  }
}
