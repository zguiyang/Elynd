import { DateTime } from 'luxon'
import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import { TtsService } from '#services/tts_service'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import type { ChapterInput } from '#types/tts'
import crypto from 'node:crypto'

interface GenerateBookAudioPayload {
  bookId: number
}

interface ChapterProcessingResult {
  chapterIndex: number
  status: 'reused' | 'generated' | 'failed'
  audioPath?: string | null
  durationMs?: number | null
  error?: string | null
}

/**
 * Default voice hash for audio generation
 * In production, this would come from book settings or voice configuration
 */
const DEFAULT_VOICE_HASH = 'default-voice'

export default class GenerateBookAudioJob extends Job {
  static get concurrency() {
    return 1
  }

  async handle(payload: GenerateBookAudioPayload) {
    const { bookId } = payload

    logger.info({ bookId }, 'Starting chapter-level audio generation')

    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception(`Book ${bookId} not found`, { status: 404 })
    }

    try {
      // Update book status to processing
      await book.merge({ audioStatus: 'processing' }).save()

      // Process chapters and collect results
      const results = await this.processChapters(bookId)

      // Check if all chapters succeeded
      const failedChapters = results.filter((r) => r.status === 'failed')

      if (failedChapters.length > 0) {
        logger.error(
          { bookId, failedCount: failedChapters.length, failedChapters },
          'Some chapters failed audio generation'
        )

        // Update book to failed status if any chapter failed
        await book.merge({ audioStatus: 'failed' }).save()

        // Throw error to mark job as failed
        throw new Exception(`Audio generation failed for ${failedChapters.length} chapter(s)`, {
          status: 500,
        })
      }

      // All chapters completed - finalize book readiness
      await this.finalizeBookReady(book, results)

      logger.info({ bookId }, 'All chapter audio generation completed')
    } catch (error) {
      logger.error({ err: error, bookId }, 'Audio generation failed')

      if (book) {
        // Only set to failed if not already set
        if (book.audioStatus !== 'failed') {
          await book.merge({ audioStatus: 'failed' }).save()
        }
      }

      throw error
    }
  }

  /**
   * Process all chapters for a book with reuse logic
   */
  private async processChapters(bookId: number): Promise<ChapterProcessingResult[]> {
    // Get all chapters for this book
    const chapters = await BookChapter.query()
      .where('bookId', bookId)
      .orderBy('chapterIndex', 'asc')
      .select(['id', 'chapterIndex', 'title', 'content'])

    const results: ChapterProcessingResult[] = []

    // Process each chapter
    for (const chapter of chapters) {
      const result = await this.processChapter(chapter, bookId)
      results.push(result)
    }

    return results
  }

  /**
   * Process a single chapter with reuse check
   */
  private async processChapter(
    chapter: BookChapter,
    bookId: number
  ): Promise<ChapterProcessingResult> {
    const chapterIndex = chapter.chapterIndex

    logger.info({ bookId, chapterIndex }, 'Processing chapter audio')

    // Compute hashes for reuse check
    const textHash = this.computeTextHash(chapter.content)
    const voiceHash = DEFAULT_VOICE_HASH

    // Check for existing successful audio with matching hashes
    const existingAudio = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('chapterIndex', chapterIndex)
      .where('textHash', textHash)
      .where('voiceHash', voiceHash)
      .where('status', 'completed')
      .first()

    if (existingAudio) {
      logger.info(
        { bookId, chapterIndex, audioPath: existingAudio.audioPath },
        'Reusing existing chapter audio'
      )

      return {
        chapterIndex,
        status: 'reused',
        audioPath: existingAudio.audioPath,
        durationMs: existingAudio.durationMs,
      }
    }

    // Generate new audio
    try {
      const chapterInput: ChapterInput = {
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        content: chapter.content,
      }

      const ttsService = await app.container.make(TtsService)
      const result = await ttsService.generateChapterAudio(chapterInput, bookId)

      // Upsert chapter audio record
      await this.upsertChapterAudio(
        bookId,
        chapterIndex,
        textHash,
        voiceHash,
        result.audioPath,
        result.duration,
        'completed',
        null
      )

      logger.info(
        { bookId, chapterIndex, duration: result.duration },
        'Chapter audio generated successfully'
      )

      return {
        chapterIndex,
        status: 'generated',
        audioPath: result.audioPath,
        durationMs: result.duration,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      logger.error({ err: error, bookId, chapterIndex }, 'Chapter audio generation failed')

      // Upsert failed record
      await this.upsertChapterAudio(
        bookId,
        chapterIndex,
        textHash,
        voiceHash,
        null,
        null,
        'failed',
        errorMessage
      )

      return {
        chapterIndex,
        status: 'failed',
        error: errorMessage,
      }
    }
  }

  /**
   * Compute text hash for a chapter
   */
  private computeTextHash(content: string): string {
    // Use the same normalization as BookHashService
    const normalized = content
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()

    return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex')
  }

  /**
   * Upsert chapter audio record
   */
  private async upsertChapterAudio(
    bookId: number,
    chapterIndex: number,
    textHash: string,
    voiceHash: string,
    audioPath: string | null,
    durationMs: number | null,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage: string | null
  ): Promise<BookChapterAudio> {
    const existing = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('chapterIndex', chapterIndex)
      .first()

    if (existing) {
      await existing
        .merge({
          textHash,
          voiceHash,
          audioPath,
          durationMs,
          status,
          errorMessage,
        })
        .save()

      return existing
    }

    return await BookChapterAudio.create({
      bookId,
      chapterIndex,
      textHash,
      voiceHash,
      audioPath,
      durationMs,
      status,
      errorMessage,
    })
  }

  /**
   * Finalize book readiness when all chapters are complete
   */
  private async finalizeBookReady(book: Book, results: ChapterProcessingResult[]): Promise<void> {
    // Verify all chapters are complete
    const totalChapters = await BookChapter.query().where('bookId', book.id).count('* as total')

    const chapterCount = Number(totalChapters[0].$extras.total)

    const completedCount = results.filter(
      (r) => r.status === 'reused' || r.status === 'generated'
    ).length

    if (completedCount !== chapterCount) {
      logger.warn(
        { bookId: book.id, completedCount, chapterCount },
        'Not all chapters completed, book will not be marked as ready'
      )
      return
    }

    // All chapters completed - mark book as ready
    // Collect all audio paths and durations for book-level audio
    const chapterAudios = await BookChapterAudio.query()
      .where('bookId', book.id)
      .where('status', 'completed')
      .orderBy('chapterIndex', 'asc')

    const audioUrl = chapterAudios[0]?.audioPath
      ? chapterAudios[0].audioPath.replace(/chapter-\d+\.mp3$/, `${book.id}.mp3`)
      : null

    const totalDuration = chapterAudios.reduce((sum, audio) => sum + (audio.durationMs || 0), 0)

    await book
      .merge({
        status: 'ready',
        isPublished: true,
        processingStep: 'completed',
        processingProgress: 100,
        audioStatus: 'completed',
        audioUrl,
        audioTiming: {
          chapters: chapterAudios.map((audio) => ({
            chapterIndex: audio.chapterIndex,
            audioPath: audio.audioPath,
            durationMs: audio.durationMs,
          })),
          totalDuration,
        },
        audioGeneratedAt: DateTime.now(),
      })
      .save()

    logger.info({ bookId: book.id, chapterCount, totalDuration }, 'Book marked as ready')
  }
}
