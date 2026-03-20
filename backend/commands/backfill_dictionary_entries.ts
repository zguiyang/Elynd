import { BaseCommand } from '@adonisjs/core/ace'
import { DictionaryService } from '#services/shared/dictionary_service'
import type { DictionaryEntry } from '#services/shared/dictionary_service'

interface LegacyVocabularyRow {
  id: number
  word: string
  details: Record<string, unknown> | null
}

export default class BackfillDictionaryEntries extends BaseCommand {
  static commandName = 'dictionary:backfill-entries'
  static description =
    'Backfill dictionary_entries and dictionary_entry_id from legacy book_vocabularies.details'

  private toDictionaryEntry(
    word: string,
    details: Record<string, unknown>
  ): DictionaryEntry | null {
    const meanings = Array.isArray(details.meanings) ? details.meanings : []

    if (meanings.length === 0) {
      return null
    }

    return {
      word: word.toLowerCase(),
      sourceLanguage: typeof details.sourceLanguage === 'string' ? details.sourceLanguage : 'en',
      localizationLanguage:
        typeof details.localizationLanguage === 'string' ? details.localizationLanguage : 'zh-CN',
      phonetic: typeof details.phonetic === 'string' ? details.phonetic : null,
      phonetics: Array.isArray(details.phonetics)
        ? (details.phonetics as Array<{ text: string; audio?: string }>).filter(
            (item) => typeof item?.text === 'string'
          )
        : [],
      meanings: meanings as DictionaryEntry['meanings'],
      articleExamples: Array.isArray(details.articleExamples)
        ? (details.articleExamples as DictionaryEntry['articleExamples'])
        : [],
      meta: {
        source: 'dictionary',
        localizationLanguage:
          typeof details.localizationLanguage === 'string' ? details.localizationLanguage : 'zh-CN',
      },
    }
  }

  async run() {
    const dictionaryService = await this.app.container.make(DictionaryService)
    const module = await import('@adonisjs/lucid/services/db')
    const database = module.default as
      | {
          rawQuery: (sql: string) => Promise<{ rows?: unknown[] }>
          from: (table: string) => {
            select: (columns: string[]) => { whereNull: (column: string) => Promise<unknown> }
            where: (
              column: string,
              value: number
            ) => {
              update: (payload: Record<string, unknown>) => Promise<unknown>
            }
          }
        }
      | undefined

    if (!database || typeof database.rawQuery !== 'function') {
      this.logger.info('Skip backfill: database service is unavailable in current command runtime')
      return
    }

    const hasDetailsResult = await database.rawQuery(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'book_vocabularies'
      AND column_name = 'details'
      LIMIT 1
    `
    )

    if ((hasDetailsResult.rows || []).length === 0) {
      this.logger.info('Skip backfill: legacy details column not found')
      return
    }

    const rows = (await database
      .from('book_vocabularies')
      .select(['id', 'word', 'details'])
      .whereNull('dictionary_entry_id')) as LegacyVocabularyRow[]

    let updated = 0
    let skipped = 0

    for (const row of rows) {
      if (!row.details || typeof row.details !== 'object') {
        skipped++
        continue
      }

      const entry = this.toDictionaryEntry(row.word, row.details)
      if (!entry) {
        skipped++
        continue
      }

      const dictionaryEntry = await dictionaryService.saveGlobalEntry(entry)

      await database
        .from('book_vocabularies')
        .where('id', row.id)
        .update({ dictionary_entry_id: dictionaryEntry.id })

      updated++
    }

    this.logger.success(`Backfill finished. updated=${updated}, skipped=${skipped}`)
  }
}
