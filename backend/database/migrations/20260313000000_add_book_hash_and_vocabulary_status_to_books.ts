import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'books'

  async up() {
    // Check if book_hash column exists
    const hasBookHash = await this.schema.hasColumn(this.tableName, 'book_hash')

    if (!hasBookHash) {
      this.schema.alterTable(this.tableName, (table) => {
        // Add book_hash column (nullable)
        table.string('book_hash', 64).nullable().after('content_hash')
      })
    }

    // Check if vocabulary_status column exists
    const hasVocabularyStatus = await this.schema.hasColumn(this.tableName, 'vocabulary_status')

    if (!hasVocabularyStatus) {
      this.schema.alterTable(this.tableName, (table) => {
        // Add vocabulary_status enum column
        table
          .enum('vocabulary_status', ['pending', 'processing', 'completed', 'failed'])
          .notNullable()
          .defaultTo('pending')
          .after('book_hash')
      })
    }

    // Create index for book_hash (only if column was just created)
    if (!hasBookHash) {
      this.schema.alterTable(this.tableName, (table) => {
        table.index('book_hash')
      })
    }
  }

  async down() {
    // Only drop if we added them (in case columns already existed)
    const hasBookHash = await this.schema.hasColumn(this.tableName, 'book_hash')
    const hasVocabularyStatus = await this.schema.hasColumn(this.tableName, 'vocabulary_status')

    if (hasBookHash) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropIndex('book_hash')
        table.dropColumn('book_hash')
      })
    }

    if (hasVocabularyStatus) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('vocabulary_status')
      })
    }
  }
}
