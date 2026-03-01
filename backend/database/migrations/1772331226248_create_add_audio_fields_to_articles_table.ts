import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'articles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('audio_url', 500).nullable()
      table.enum('audio_status', ['pending', 'processing', 'completed', 'failed']).nullable()
      table.json('audio_timing').nullable()
      table.timestamp('audio_generated_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('audio_url')
      table.dropColumn('audio_status')
      table.dropColumn('audio_timing')
      table.dropColumn('audio_generated_at')
    })
  }
}
