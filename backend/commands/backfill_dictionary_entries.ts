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
    const meanings = Array.isArray(details.meanings)
      ? details.meanings
          .map((meaning: unknown) => {
            if (typeof meaning !== 'object' || meaning === null || Array.isArray(meaning)) {
              return null
            }

            const record = meaning as Record<string, unknown>
            const partOfSpeech =
              typeof record.partOfSpeech === 'string' && record.partOfSpeech.trim().length > 0
                ? record.partOfSpeech.trim()
                : null
            const localizedMeaning =
              typeof record.localizedMeaning === 'string' &&
              record.localizedMeaning.trim().length > 0
                ? record.localizedMeaning.trim()
                : null
            const explanation =
              typeof record.explanation === 'string' && record.explanation.trim().length > 0
                ? record.explanation.trim()
                : typeof record.plainExplanation === 'string' &&
                    record.plainExplanation.trim().length > 0
                  ? record.plainExplanation.trim()
                  : localizedMeaning
            const examples = Array.isArray(record.examples)
              ? (record.examples as Array<Record<string, unknown>>)
                  .map((example) => {
                    const sourceText =
                      typeof example.sourceText === 'string' && example.sourceText.trim().length > 0
                        ? example.sourceText.trim()
                        : null
                    const localizedText =
                      typeof example.localizedText === 'string' &&
                      example.localizedText.trim().length > 0
                        ? example.localizedText.trim()
                        : sourceText

                    if (!sourceText || !localizedText) {
                      return null
                    }

                    return {
                      sourceText,
                      localizedText,
                      source:
                        example.source === 'dictionary' ||
                        example.source === 'article' ||
                        example.source === 'ai'
                          ? example.source
                          : 'dictionary',
                    }
                  })
                  .filter((example): example is NonNullable<typeof example> => example !== null)
              : []

            if (!partOfSpeech || !localizedMeaning || !explanation) {
              return null
            }

            return {
              partOfSpeech,
              localizedMeaning,
              explanation,
              examples:
                examples.length > 0
                  ? examples
                  : [
                      {
                        sourceText: localizedMeaning,
                        localizedText: localizedMeaning,
                        source: 'dictionary',
                      },
                    ],
            }
          })
          .filter(
            (
              meaning
            ): meaning is {
              partOfSpeech: string
              localizedMeaning: string
              explanation: string
              examples: Array<{
                sourceText: string
                localizedText: string
                source: 'dictionary' | 'article' | 'ai'
              }>
            } => meaning !== null
          )
      : []

    if (meanings.length === 0) {
      return null
    }

    return {
      word: word.toLowerCase(),
      sourceLanguage: typeof details.sourceLanguage === 'string' ? details.sourceLanguage : 'en',
      localizationLanguage:
        typeof details.localizationLanguage === 'string' ? details.localizationLanguage : 'zh-CN',
      phonetic: typeof details.phonetic === 'string' ? details.phonetic : null,
      meanings: meanings as DictionaryEntry['meanings'],
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
