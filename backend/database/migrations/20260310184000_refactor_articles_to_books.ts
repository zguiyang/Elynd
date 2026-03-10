import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    const dropIfExists = async (tableName: string) => {
      const exists = await this.schema.hasTable(tableName)
      if (exists) {
        this.schema.dropTable(tableName)
      }
    }

    await dropIfExists('article_chats')
    await dropIfExists('article_read_progresses')
    await dropIfExists('article_vocabularies')
    await dropIfExists('article_chapters')
    await dropIfExists('article_tags')
    await dropIfExists('articles')

    this.schema.createTable('books', (table) => {
      table.increments('id').notNullable()
      table.string('title', 200).notNullable()
      table
        .enum('source', ['user_uploaded', 'public_domain', 'ai_generated'])
        .notNullable()
        .defaultTo('ai_generated')
      table.string('author', 200).nullable()
      table.text('description').nullable()
      table.string('difficulty_level', 20).notNullable()
      table.integer('word_count').notNullable()
      table.integer('reading_time').notNullable()
      table.boolean('is_published').notNullable().defaultTo(true)
      table.integer('created_by').unsigned().references('users.id').onDelete('CASCADE')
      table.enum('status', ['processing', 'ready', 'failed']).notNullable().defaultTo('ready')
      table.string('processing_step', 100).nullable()
      table.integer('processing_progress').notNullable().defaultTo(0)
      table.text('processing_error').nullable()
      table.string('audio_url', 500).nullable()
      table.enum('audio_status', ['pending', 'processing', 'completed', 'failed']).nullable()
      table.json('audio_timing').nullable()
      table.timestamp('audio_generated_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })

    this.schema.createTable('book_chapters', (table) => {
      table.increments('id').notNullable()
      table.integer('book_id').unsigned().references('books.id').onDelete('CASCADE').notNullable()
      table.integer('chapter_index').notNullable()
      table.string('title', 200).notNullable()
      table.text('content').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['book_id', 'chapter_index'])
    })

    this.schema.createTable('book_vocabularies', (table) => {
      table.increments('id').notNullable()
      table.integer('book_id').unsigned().references('books.id').onDelete('CASCADE').notNullable()
      table.string('word', 100).notNullable()
      table.string('lemma', 100).notNullable()
      table.integer('frequency').notNullable().defaultTo(0)
      table.string('meaning', 500).notNullable()
      table.text('sentence').notNullable()
      table.string('phonetic', 100).nullable()
      table.string('phonetic_text', 100).nullable()
      table.string('phonetic_audio', 500).nullable()
      table.jsonb('details').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['book_id'])
      table.index(['lemma'])
    })

    this.schema.createTable('book_chats', (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE').notNullable()
      table.integer('book_id').unsigned().references('books.id').onDelete('CASCADE').notNullable()
      table.string('role').notNullable()
      table.text('content').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['user_id', 'book_id'])
    })

    this.schema.createTable('book_tags', (table) => {
      table.integer('book_id').unsigned().references('books.id').onDelete('CASCADE')
      table.integer('tag_id').unsigned().references('tags.id').onDelete('CASCADE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.primary(['book_id', 'tag_id'])
    })

    this.schema.createTable('book_read_progresses', (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE').notNullable()
      table.integer('book_id').unsigned().references('books.id').onDelete('CASCADE').notNullable()
      table.integer('progress').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['user_id', 'book_id'])
    })
  }

  async down() {
    this.schema.dropTable('book_read_progresses')
    this.schema.dropTable('book_tags')
    this.schema.dropTable('book_chats')
    this.schema.dropTable('book_vocabularies')
    this.schema.dropTable('book_chapters')
    this.schema.dropTable('books')
  }
}
