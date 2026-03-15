import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { TtsService } from '#services/tts_service'
import { BOOK_IMPORT_STEP } from '#constants'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import { BookProcessingLogService } from '#services/book_processing_log_service'
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

  private logService = new BookProcessingLogService()

  async handle(payload: GenerateBookAudioPayload) {
    const { bookId } = payload

    logger.info({ bookId }, 'Starting chapter-level audio generation')

    const book = await Book.find(bookId)

    if (!book) {
      logger.warn({ bookId }, 'Skip audio job because book no longer exists')
      return
    }

    const runLog = await this.logService.getOrCreateActiveRun(bookId, 'import')

    try {
      await book.merge({ audioStatus: 'processing' }).save()

      // Process chapters and collect results with step logging
      const results = await this.processChapters(bookId, runLog.id)

      // Calculate summary
      // Check if all chapters succeeded
      const failedResults = results.filter((r) => r.status === 'failed')

      if (failedResults.length > 0) {
        const summaryMessage = `Audio generation failed for ${failedResults.length} chapter(s)`
        logger.error(
          { bookId, failedCount: failedResults.length, failedResults },
          'Some chapters failed audio generation'
        )

        await book.merge({ audioStatus: 'failed' }).save()

        // Throw error to mark job as failed
        throw new Exception(summaryMessage, {
          status: 500,
        })
      }

      const chapterAudios = await BookChapterAudio.query()
        .where('bookId', book.id)
        .where('status', 'completed')
        .orderBy('chapterIndex', 'asc')
      const totalDuration = chapterAudios.reduce((sum, audio) => sum + (audio.durationMs || 0), 0)
      const audioUrl = chapterAudios[0]?.audioPath
        ? chapterAudios[0].audioPath.replace(/chapter-\d+\.mp3$/, `${book.id}.mp3`)
        : null

      await book
        .merge({
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
        })
        .save()

      await this.finalizeIfParallelTasksCompleted(book, runLog.id)
      logger.info({ bookId }, 'All chapter audio generation completed')
    } catch (error) {
      logger.error({ err: error, bookId }, 'Audio generation failed')

      await book.merge({ audioStatus: 'failed' }).save()

      throw error
    }
  }

  private async finalizeIfParallelTasksCompleted(book: Book, runId: number) {
    await book.refresh()

    if (book.status === 'cancelled') {
      logger.info({ bookId: book.id, runId }, 'Skip finalize because import is cancelled')
      return
    }

    if (book.audioStatus !== 'completed' || book.vocabularyStatus !== 'completed') {
      return
    }

    await this.logService.completeRun(runId)

    await book
      .merge({
        status: 'ready',
        processingStep: BOOK_IMPORT_STEP.COMPLETED,
        processingProgress: 100,
        processingError: null,
        isPublished: true,
      })
      .save()

    logger.info({ bookId: book.id, runId }, 'Parallel import tasks finalized')
  }

  /**
   * Process all chapters for a book with reuse logic and bounded concurrency
   */
  private async processChapters(
    bookId: number,
    runLogId: number
  ): Promise<ChapterProcessingResult[]> {
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
      return await this.processChapter(chapter, bookId, runLogId)
    })
  }

  /**
   * Process a single chapter with reuse check
   */
  private async processChapter(
    chapter: BookChapter,
    bookId: number,
    runLogId: number
  ): Promise<ChapterProcessingResult> {
    const chapterIndex = chapter.chapterIndex
    const itemKey = `chapter:${chapterIndex}`

    logger.info({ bookId, chapterIndex }, 'Processing chapter audio')

    // Compute hashes for reuse check
    const textHash = this.computeTextHash(chapter.content)
    const voiceHash = DEFAULT_VOICE_HASH
    const inputHash = crypto
      .createHash('sha256')
      .update(`${chapter.title}|${textHash}|${voiceHash}`)
      .digest('hex')

    // Start step log for this chapter
    const stepLog = await this.logService.startStep(
      runLogId,
      bookId,
      'audio_generate_chapter',
      itemKey,
      inputHash
    )

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

      // Mark step as skipped since we're reusing
      await this.logService.skipStep(stepLog.id)

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

      // Mark step as successful
      await this.logService.completeStep(stepLog.id, {
        audioPath: result.audioPath,
        durationMs: result.duration,
      })

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

      // Mark step as failed
      await this.logService.failStep(stepLog.id, errorMessage, 'AUDIO_GENERATION_FAILED')

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
