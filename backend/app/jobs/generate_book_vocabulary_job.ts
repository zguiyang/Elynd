import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import { DictionaryService } from '#services/dictionary_service'
import Book from '#models/book'
import BookVocabulary from '#models/book_vocabulary'

interface GenerateVocabularyPayload {
  bookId: number
}

export default class GenerateBookVocabularyJob extends Job {
  static get concurrency() {
    return 3
  }

  async handle(payload: GenerateVocabularyPayload) {
    const { bookId } = payload

    logger.info({ bookId }, 'Starting vocabulary details generation')

    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception(`Book ${bookId} not found`, { status: 404 })
    }

    const vocabularies = await BookVocabulary.query().where('bookId', bookId)

    if (vocabularies.length === 0) {
      logger.info({ bookId }, 'No vocabulary found for book')
      return
    }

    const words = vocabularies.map((v) => v.word)

    try {
      const dictionaryService = await app.container.make(DictionaryService)

      const results = await dictionaryService.lookupBatch(words)

      for (const vocabulary of vocabularies) {
        const entry = results.get(vocabulary.word.toLowerCase())

        if (entry) {
          const audioUrl = entry.phonetics?.find((p) => p.audio)?.audio || null
          const phoneticText = entry.phonetic || entry.phonetics?.[0]?.text || null

          await vocabulary
            .merge({
              phoneticText,
              phoneticAudio: audioUrl,
              details: {
                meanings: entry.meanings,
              },
            })
            .save()
        }
      }

      logger.info(
        {
          bookId,
          total: vocabularies.length,
          updated: Array.from(results.values()).filter((v) => v !== null).length,
        },
        'Vocabulary details generation completed'
      )
    } catch (error) {
      logger.error({ err: error, bookId }, 'Vocabulary details generation failed')
      throw error
    }
  }
}
