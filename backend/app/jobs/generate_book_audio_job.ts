import { DateTime } from 'luxon'
import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { TtsService } from '#services/tts_service'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import BookProcessingRunLog from '#models/book_processing_run_log'
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

    // Create run log for tracking
    const runLog = await BookProcessingRunLog.create({
      bookId,
      jobType: 'import',
      status: 'processing',
      currentStep: 'generate_audio',
      progress: 0,
      startedAt: DateTime.now(),
    })

    try {
      // Update book status to processing
      await book.merge({ audioStatus: 'processing' }).save()

      // Process chapters and collect results
      const results = await this.processChapters(bookId)

      // Calculate summary
      const totalChapters = results.length
      const completedChapters = results.filter(
        (r) => r.status === 'reused' || r.status === 'generated'
      ).length
      const failedChapters = results.filter((r) => r.status === 'failed').length
      const reusedChapters = results.filter((r) => r.status === 'reused').length

      // Check if all chapters succeeded
      const failedResults = results.filter((r) => r.status === 'failed')

      if (failedResults.length > 0) {
        const summaryMessage = `Audio generation failed for ${failedResults.length} chapter(s)`
        logger.error(
          { bookId, failedCount: failedResults.length, failedResults },
          'Some chapters failed audio generation'
        )

        // Converge to failed state with all diagnostic fields
        await book
          .merge({
            status: 'failed',
            audioStatus: 'failed',
            processingStep: 'audio_failed',
            processingError: summaryMessage,
          })
          .save()

        // Update run log with failure metadata
        await runLog
          .merge({
            status: 'failed',
            currentStep: 'generate_audio',
            progress: Math.round((completedChapters / totalChapters) * 100),
            finishedAt: DateTime.now(),
            durationMs: DateTime.now().toMillis() - runLog.startedAt.toMillis(),
            errorMessage: summaryMessage,
            errorCode: 'AUDIO_GENERATION_FAILED',
            metadata: {
              context: { bookId, jobType: 'import' },
              summary: {
                totalChapters,
                completedChapters,
                failedChapters,
                reusedChapters,
              },
              audio: {
                firstFailedChapterIndex: failedResults[0]?.chapterIndex,
                lastProcessedChapterIndex: results[results.length - 1]?.chapterIndex,
                suspectedSystemicFailure: failedResults.length > 1,
              },
              failure: {
                stage: 'generate_audio',
                errorCode: 'audio_generation_failed',
                errorMessage: summaryMessage,
              },
            },
          })
          .save()

        // Throw error to mark job as failed
        throw new Exception(summaryMessage, {
          status: 500,
        })
      }

      // All chapters completed - update run log with success metadata
      await runLog
        .merge({
          status: 'success',
          currentStep: 'generate_audio',
          progress: 100,
          finishedAt: DateTime.now(),
          durationMs: DateTime.now().toMillis() - runLog.startedAt.toMillis(),
          metadata: {
            context: { bookId, jobType: 'import' },
            summary: {
              totalChapters,
              completedChapters,
              failedChapters,
              reusedChapters,
            },
            audio: {
              lastProcessedChapterIndex: results[results.length - 1]?.chapterIndex,
            },
          },
        })
        .save()

      // All chapters completed - finalize book readiness
      await this.finalizeBookReady(book, results)

      logger.info({ bookId }, 'All chapter audio generation completed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error, bookId }, 'Audio generation failed')

      if (book) {
        // Converge to failed state with all diagnostic fields
        await book
          .merge({
            status: 'failed',
            audioStatus: 'failed',
            processingStep: 'audio_failed',
            processingError: errorMessage,
          })
          .save()
      }

      // Update run log if not already failed
      if (runLog.status !== 'failed') {
        await runLog
          .merge({
            status: 'failed',
            finishedAt: DateTime.now(),
            durationMs: runLog.startedAt
              ? DateTime.now().toMillis() - runLog.startedAt.toMillis()
              : null,
            errorMessage: errorMessage,
            errorCode: 'AUDIO_GENERATION_FAILED',
          })
          .save()
      }

      throw error
    }
  }

  /**
   * Process all chapters for a book with reuse logic and bounded concurrency
   */
  private async processChapters(bookId: number): Promise<ChapterProcessingResult[]> {
    // Get all chapters for this book
    const chapters = await BookChapter.query()
      .where('bookId', bookId)
      .orderBy('chapterIndex', 'asc')
      .select(['id', 'chapterIndex', 'title', 'content'])

    const concurrency = this.getChapterConcurrency()

    logger.info(
      { bookId, chapterCount: chapters.length, concurrency },
      'Processing chapters with bounded concurrency'
    )

    // Process chapters with bounded concurrency
    return await this.runWithConcurrency(chapters, concurrency, async (chapter) => {
      return await this.processChapter(chapter, bookId)
    })
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
      // Write processing status before starting synthesis
      await this.upsertChapterAudio(
        bookId,
        chapterIndex,
        textHash,
        voiceHash,
        null,
        null,
        'processing',
        null
      )

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

  /**
   * Get chapter concurrency limit from environment
   */
  private getChapterConcurrency(): number {
    const concurrency = env.get('BOOK_AUDIO_CHAPTER_CONCURRENCY', 3)
    // Clamp invalid values to 1
    if (typeof concurrency !== 'number' || concurrency < 1) {
      return 1
    }
    return Math.min(Math.floor(concurrency), 10) // Cap at 10 to prevent resource exhaustion
  }

  /**
   * Run async workers with bounded concurrency
   * Preserves input order in returned results
   */
  private async runWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length)
    const queue = items.map((item, index) => ({ item, index }))

    async function processNext(): Promise<void> {
      while (queue.length > 0) {
        const { item, index } = queue.shift()!
        const result = await worker(item)
        results[index] = result
      }
    }

    // Start limited number of workers
    const workers = Array(Math.min(limit, items.length))
      .fill(null)
      .map(() => processNext())

    await Promise.all(workers)

    return results
  }
}
