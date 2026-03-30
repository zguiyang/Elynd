import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookVocabulary from '#models/book_vocabulary'
import BookChapterAudio from '#models/book_chapter_audio'
import BookProcessingRunLog from '#models/book_processing_run_log'
import BookProcessingStepLog from '#models/book_processing_step_log'
import GenerateTtsJob from '#jobs/generate_tts_job'
import EnrichVocabularyJob from '#jobs/enrich_vocabulary_job'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import { buildCanonicalChapterText } from '#utils/book_text_normalizer'
import { BOOK_IMPORT_STEP } from '#constants'
import type { BookImportStep } from '#constants'
import type { ListPublishedParams } from '#types/book'
import type { WordTiming } from '#types/tts'

export interface ChapterAudioSummary {
  total: number
  completed: number
  pending: number
  failed: number
}

export interface VocabularySummary {
  total: number
  completed: number
  pending: number
  failed: number
}

export interface LatestRunSummary {
  id: number
  jobType: string
  status: string
  currentStep: string | null
  progress: number
  startedAt: string | null
  finishedAt: string | null
  errorCode: string | null
  errorMessage: string | null
  outputRef: Record<string, unknown> | null
}

export interface EnrichedBookStatus {
  id: number
  status: string
  processingStep: string | null
  processingProgress: number
  processingError: string | null
  bookHash: string | null
  audioStatus: string | null
  vocabularyStatus: string
  latestRun: LatestRunSummary | null
  chapterAudioSummary: ChapterAudioSummary
  vocabularySummary: VocabularySummary
}

export interface ChapterSentenceTiming {
  paragraphIndex: number
  sentenceIndex: number
  text: string
  startMs: number | null
  endMs: number | null
  isTitle?: boolean
}

@inject()
export class BookService {
  constructor(private bookImportOrchestratorService: BookImportOrchestratorService) {}

  private normalizeTimingWordOffsets(canonicalText: string, timingWords: WordTiming[] | null) {
    if (!timingWords?.length) {
      return [] as WordTiming[]
    }

    const words = [...timingWords].sort((a, b) => a.audioOffset - b.audioOffset)
    const normalizedWords: WordTiming[] = []
    let searchStart = 0

    for (const word of words) {
      const normalizedWord = buildCanonicalChapterText(word.word, '')
        .replace(/\n\s*\n$/, '')
        .trim()

      if (!normalizedWord) {
        normalizedWords.push(word)
        continue
      }

      const matchedOffset = canonicalText.indexOf(normalizedWord, searchStart)
      const resolvedOffset = matchedOffset >= 0 ? matchedOffset : word.textOffset

      normalizedWords.push({
        ...word,
        textOffset: resolvedOffset,
        wordLength: normalizedWord.length,
      })

      searchStart =
        matchedOffset >= 0 ? matchedOffset + normalizedWord.length : word.textOffset + word.wordLength
    }

    return normalizedWords.sort((a, b) => a.textOffset - b.textOffset)
  }

  async listPublished(params: ListPublishedParams) {
    const query = Book.query()
      .where('isPublished', true)
      .select(
        'id',
        'title',
        'source',
        'author',
        'description',
        'levelId',
        'status',
        'wordCount',
        'readingTime',
        'createdAt'
      )
      .preload('level')
      .preload('tags')
      .preload('chapters', (chapterQuery) => {
        chapterQuery.select('id', 'bookId', 'chapterIndex', 'title')
      })

    if (params.levelId) {
      query.where('levelId', params.levelId)
    }

    if (params.tagId) {
      const tagId = params.tagId
      query.whereHas('tags', (tagQuery) => {
        tagQuery.where('id', tagId)
      })
    }

    return query.orderBy('createdAt', 'desc').paginate(params.page || 1, params.perPage || 20)
  }

  async findPublishedById(id: number) {
    const book = await this.buildBookQuery(true, true).where('id', id).first()

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    return book
  }

  async findById(id: number) {
    const book = await this.buildBookQuery(false, false).where('id', id).first()

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    return book
  }

  async findReadableBookById(id: number, requester: { isAdmin: boolean }): Promise<Book> {
    if (requester.isAdmin) {
      return this.findById(id)
    }

    return this.findPublishedById(id)
  }

  private buildBookQuery(requirePublished: boolean, isPublic: boolean) {
    const selectFields = isPublic
      ? [
          'id',
          'title',
          'source',
          'author',
          'description',
          'levelId',
          'status',
          'wordCount',
          'readingTime',
          'isPublished',
          'createdAt',
          'updatedAt',
          'audioUrl',
          'audioStatus',
        ]
      : undefined

    const query = Book.query()
      .if(selectFields, (q) => q.select(...selectFields!))
      .preload('level')
      .preload('tags')
      .preload('chapters', (chapterQuery) => {
        chapterQuery.select('id', 'bookId', 'chapterIndex', 'title')
      })

    if (requirePublished) {
      query.where('isPublished', true)
    }

    return query
  }

  private serializeLatestRun(
    latestRun: BookProcessingRunLog,
    outputRef: Record<string, unknown> | null
  ): LatestRunSummary {
    return {
      id: latestRun.id,
      jobType: latestRun.jobType,
      status: latestRun.status,
      currentStep: latestRun.currentStep,
      progress: latestRun.progress,
      startedAt: latestRun.startedAt ? latestRun.startedAt.toISO() : null,
      finishedAt: latestRun.finishedAt ? latestRun.finishedAt.toISO() : null,
      errorCode: latestRun.errorCode,
      errorMessage: latestRun.errorMessage,
      outputRef,
    }
  }

  async getLatestRunSummary(bookId: number): Promise<LatestRunSummary | null> {
    const summaries = await this.getLatestRunSummaries([bookId])
    return summaries.get(bookId) || null
  }

  async getLatestRunSummaries(bookIds: number[]): Promise<Map<number, LatestRunSummary>> {
    if (bookIds.length === 0) {
      return new Map()
    }

    const latestRuns = await BookProcessingRunLog.query()
      .whereIn('bookId', bookIds)
      .orderBy('startedAt', 'desc')
      .orderBy('id', 'desc')

    const latestRunByBookId = new Map<number, BookProcessingRunLog>()
    for (const latestRun of latestRuns) {
      if (!latestRunByBookId.has(latestRun.bookId)) {
        latestRunByBookId.set(latestRun.bookId, latestRun)
      }
    }

    if (latestRunByBookId.size === 0) {
      return new Map()
    }

    const runIds = Array.from(latestRunByBookId.values()).map((latestRun) => latestRun.id)
    const stepLogs = await BookProcessingStepLog.query()
      .whereIn('runLogId', runIds)
      .where('stepKey', BOOK_IMPORT_STEP.ENRICH_VOCABULARY)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    const outputRefByRunId = new Map<number, Record<string, unknown> | null>()
    for (const stepLog of stepLogs) {
      if (!outputRefByRunId.has(stepLog.runLogId)) {
        outputRefByRunId.set(stepLog.runLogId, stepLog.outputRef || null)
      }
    }

    const summaries = new Map<number, LatestRunSummary>()
    for (const [bookId, latestRun] of latestRunByBookId.entries()) {
      summaries.set(
        bookId,
        this.serializeLatestRun(latestRun, outputRefByRunId.get(latestRun.id) || null)
      )
    }

    return summaries
  }

  async getChapterByIndex(bookId: number, chapterIndex: number) {
    const chapter = await BookChapter.query()
      .where('bookId', bookId)
      .where('chapterIndex', chapterIndex)
      .select('id', 'bookId', 'chapterIndex', 'title', 'content')
      .first()

    if (!chapter) {
      throw new Exception('Chapter not found', { status: 404 })
    }

    return chapter
  }

  async getVocabularyByBookId(bookId: number) {
    let vocabularies: BookVocabulary[] = []

    try {
      vocabularies = await BookVocabulary.query()
        .where('bookId', bookId)
        .preload('dictionaryEntry')
        .orderBy('id', 'asc')
    } catch {
      vocabularies = await BookVocabulary.query().where('bookId', bookId).orderBy('id', 'asc')
    }

    return vocabularies.map((item) => {
      const dictionaryEntry = item.dictionaryEntry || null

      return {
        word: item.word,
        phonetic: dictionaryEntry?.phonetic || null,
        meanings: dictionaryEntry?.meanings || [],
        sentence: item.sentence || null,
        meta: null,
        dictionaryEntryId: dictionaryEntry?.id || null,
      }
    })
  }

  async retryAudioGeneration(bookId: number, userId: number) {
    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    if (book.audioStatus !== 'failed') {
      throw new Exception('Can only retry books with failed audio status', { status: 400 })
    }

    await this.clearBookAudioFiles(book.id, book.audioUrl)

    const previousStep: BookImportStep = BOOK_IMPORT_STEP.ENRICH_VOCABULARY
    const previousProgress = BookImportOrchestratorService.getBaseProgressByStep(previousStep)
    let runId = 0

    await db.transaction(async (trx) => {
      await BookChapterAudio.query({ client: trx }).where('bookId', book.id).delete()

      const runLog = await BookProcessingRunLog.create(
        {
          bookId: book.id,
          jobType: 'import',
          status: 'processing',
          currentStep: previousStep,
          progress: previousProgress,
          startedAt: DateTime.now(),
          metadata: {
            retryRequestedAt: DateTime.now().toISO(),
            retryRequestedBy: userId,
            retryStep: BOOK_IMPORT_STEP.GENERATE_TTS,
            retryMode: 'audio_only',
          },
        },
        { client: trx }
      )
      runId = runLog.id

      await book
        .useTransaction(trx)
        .merge({
          status: 'processing',
          processingStep: previousStep,
          processingProgress: previousProgress,
          processingError: null,
          audioUrl: null,
          audioTiming: null,
          audioGeneratedAt: null,
          audioStatus: 'pending',
        })
        .save()
    })

    await GenerateTtsJob.dispatch({
      bookId: book.id,
      userId,
      runId,
    })

    return {
      bookId: book.id,
      status: 'processing',
    }
  }

  async retryVocabularyGeneration(bookId: number, userId: number) {
    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    if (book.vocabularyStatus !== 'failed') {
      throw new Exception('Can only retry books with failed vocabulary status', { status: 400 })
    }

    let runId = 0

    await db.transaction(async (trx) => {
      const runLog = await BookProcessingRunLog.create(
        {
          bookId: book.id,
          jobType: 'import',
          status: 'processing',
          currentStep: BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
          progress: BookImportOrchestratorService.getBaseProgressByStep(
            BOOK_IMPORT_STEP.ENRICH_VOCABULARY
          ),
          startedAt: DateTime.now(),
          metadata: {
            retryRequestedAt: DateTime.now().toISO(),
            retryRequestedBy: userId,
            retryStep: BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
            retryMode: 'vocabulary_only',
          },
        },
        { client: trx }
      )
      runId = runLog.id

      await book
        .useTransaction(trx)
        .merge({
          status: 'processing',
          processingStep: BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
          processingProgress: BookImportOrchestratorService.getBaseProgressByStep(
            BOOK_IMPORT_STEP.ENRICH_VOCABULARY
          ),
          processingError: null,
          vocabularyStatus: 'pending',
        })
        .save()
    })

    await EnrichVocabularyJob.dispatch({
      bookId: book.id,
      userId,
      runId,
    })

    return {
      bookId: book.id,
      vocabularyStatus: 'pending',
    }
  }

  /**
   * Get chapter audio metadata for a specific chapter
   */
  async getChapterAudio(bookId: number, chapterIndex: number) {
    const audio = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('chapterIndex', chapterIndex)
      .orderBy('updatedAt', 'desc')
      .first()

    if (!audio) {
      return null
    }

    // Only return audioPath and durationMs for completed status
    const isCompleted = audio.status === 'completed'

    return {
      chapterIndex: audio.chapterIndex,
      audioPath: isCompleted ? audio.audioPath : null,
      durationMs: isCompleted ? audio.durationMs : null,
      timingWords: isCompleted ? audio.timingWords : null,
      status: audio.status,
    }
  }

  getChapterSentenceTimings(
    chapterTitle: string,
    chapterContent: string,
    timingWords: WordTiming[] | null
  ): ChapterSentenceTiming[] {
    const canonicalText = buildCanonicalChapterText(chapterTitle, chapterContent)
    if (!canonicalText.trim()) {
      return []
    }

    const words = this.normalizeTimingWordOffsets(canonicalText, timingWords)
    const paragraphs = canonicalText.split(/\n\s*\n/)
    const sentenceTimings: ChapterSentenceTiming[] = []
    let paragraphSearchStart = 0

    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
      const paragraphText = paragraphs[paragraphIndex]
      if (!paragraphText.trim()) {
        continue
      }

      const paragraphOffset = canonicalText.indexOf(paragraphText, paragraphSearchStart)
      if (paragraphOffset < 0) {
        continue
      }
      paragraphSearchStart = paragraphOffset + paragraphText.length

      const sentences = this.splitParagraphIntoSentences(paragraphText)
      for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
        const sentence = sentences[sentenceIndex]
        const sentenceStart = paragraphOffset + sentence.startOffset
        const sentenceEnd = paragraphOffset + sentence.endOffset

        const wordsInRange = words.filter((word) => {
          const wordStart = word.textOffset
          const wordEnd = word.textOffset + word.wordLength
          return wordEnd > sentenceStart && wordStart < sentenceEnd
        })

        const fallbackWord = words.find((word) => word.textOffset >= sentenceStart)
        const startMs = wordsInRange.length > 0
          ? wordsInRange[0].audioOffset
          : (fallbackWord?.audioOffset ?? null)
        let endMs = wordsInRange.length > 0
          ? Math.max(...wordsInRange.map((word) => word.audioOffset + word.duration))
          : null

        sentenceTimings.push({
          paragraphIndex: paragraphIndex === 0 ? -1 : paragraphIndex - 1,
          sentenceIndex,
          text: sentence.text,
          startMs,
          endMs,
          isTitle: paragraphIndex === 0,
        })
      }
    }

    for (let index = 0; index < sentenceTimings.length; index++) {
      const current = sentenceTimings[index]
      if (current.endMs !== null || current.startMs === null) {
        continue
      }

      const nextWithStart = sentenceTimings
        .slice(index + 1)
        .find((item) => item.startMs !== null)
      current.endMs = nextWithStart?.startMs !== null && nextWithStart?.startMs !== undefined
        ? Math.max(current.startMs, nextWithStart.startMs - 1)
        : current.startMs + 800
    }

    return sentenceTimings
  }

  private splitParagraphIntoSentences(paragraph: string) {
    const segments: Array<{ text: string; startOffset: number; endOffset: number }> = []
    // Split by mainstream English clause/sentence punctuation to support tighter sync highlights.
    const pattern = /[^.!?,;:]+(?:[.!?,;:]+["')\]]*)?(?=\s+|$)/g
    let match: RegExpExecArray | null

    while ((match = pattern.exec(paragraph)) !== null) {
      const raw = match[0]
      const trimmed = raw.trim()
      if (!trimmed) {
        continue
      }

      const startInRaw = raw.indexOf(trimmed)
      const startOffset = match.index + Math.max(0, startInRaw)
      const endOffset = startOffset + trimmed.length

      segments.push({
        text: trimmed,
        startOffset,
        endOffset,
      })
    }

    if (segments.length === 0 && paragraph.trim()) {
      return [
        {
          text: paragraph.trim(),
          startOffset: 0,
          endOffset: paragraph.trim().length,
        },
      ]
    }

    return segments
  }

  /**
   * Get all chapter audios for a book
   */
  async getAllChapterAudios(bookId: number) {
    const audios = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'completed')
      .orderBy('chapterIndex', 'asc')

    return audios.map((audio) => ({
      chapterIndex: audio.chapterIndex,
      audioPath: audio.audioPath,
      durationMs: audio.durationMs,
      status: audio.status,
    }))
  }

  /**
   * Check if all chapters have completed audio
   */
  async areAllChaptersReady(bookId: number): Promise<boolean> {
    const totalChapters = await BookChapter.query().where('bookId', bookId).count('* as total')

    const chapterCount = Number(totalChapters[0].$extras.total)

    if (chapterCount === 0) {
      return false
    }

    const completedAudios = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'completed')
      .count('* as total')

    const completedCount = Number(completedAudios[0].$extras.total)

    return completedCount === chapterCount
  }

  /**
   * Get enriched book status with run diagnostics and chapter audio summary
   */
  async getEnrichedStatus(bookId: number): Promise<EnrichedBookStatus> {
    // Get basic book info
    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    const latestRun = await this.getLatestRunSummary(bookId)

    // Get chapter audio summary
    const totalChaptersResult = await BookChapter.query()
      .where('bookId', bookId)
      .count('* as total')

    const totalChapters = Number(totalChaptersResult[0].$extras.total)

    const completedAudiosResult = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'completed')
      .count('* as total')

    const completedCount = Number(completedAudiosResult[0].$extras.total)

    const failedAudiosResult = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'failed')
      .count('* as total')

    const failedCount = Number(failedAudiosResult[0].$extras.total)

    const pendingAudiosResult = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'pending')
      .count('* as total')

    const pendingCount = Number(pendingAudiosResult[0].$extras.total)

    // Get vocabulary summary
    const totalVocabResult = await BookVocabulary.query()
      .where('bookId', bookId)
      .count('* as total')

    const totalVocab = Number(totalVocabResult[0].$extras.total)

    // Compute vocabulary counts based on book-level vocabularyStatus
    let vocabCompleted = 0
    let vocabPending = 0
    let vocabFailed = 0

    if (book.vocabularyStatus === 'completed') {
      vocabCompleted = totalVocab
      vocabPending = 0
      vocabFailed = 0
    } else if (book.vocabularyStatus === 'failed') {
      vocabCompleted = 0
      vocabPending = 0
      vocabFailed = totalVocab
    } else {
      // pending or processing
      vocabCompleted = 0
      vocabPending = totalVocab
      vocabFailed = 0
    }

    return {
      id: book.id,
      status: book.status,
      processingStep: book.processingStep,
      processingProgress: book.processingProgress,
      processingError: book.processingError,
      bookHash: book.bookHash,
      audioStatus: book.audioStatus,
      vocabularyStatus: book.vocabularyStatus,
      latestRun,
      chapterAudioSummary: {
        total: totalChapters,
        completed: completedCount,
        pending: pendingCount,
        failed: failedCount,
      },
      vocabularySummary: {
        total: totalVocab,
        completed: vocabCompleted,
        pending: vocabPending,
        failed: vocabFailed,
      },
    }
  }

  /**
   * Rebuild chapters from source file
   * Reuses import pipeline from raw source (without upload step)
   */
  async rebuildChapters(bookId: number, userId: number) {
    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    if (!book.rawFilePath) {
      throw new Exception('Book has no source file to rebuild from', { status: 400 })
    }

    if (book.status === 'processing') {
      throw new Exception('Book is processing, stop it first before rebuild', { status: 400 })
    }

    await this.clearBookAudioFiles(book.id, book.audioUrl)

    await db.transaction(async (trx) => {
      await BookChapter.query({ client: trx }).where('bookId', book.id).delete()
      await BookChapterAudio.query({ client: trx }).where('bookId', book.id).delete()
      await BookVocabulary.query({ client: trx }).where('bookId', book.id).delete()

      await book
        .useTransaction(trx)
        .merge({
          status: 'processing',
          processingStep: BOOK_IMPORT_STEP.PREPARE_IMPORT,
          processingProgress: 0,
          processingError: null,
          isPublished: false,
          levelId: book.levelId,
          contentHash: null,
          wordCount: 0,
          readingTime: 1,
          audioUrl: null,
          audioTiming: null,
          audioGeneratedAt: null,
          audioStatus: 'pending',
          vocabularyStatus: 'pending',
        })
        .save()
    })

    // Ensure no stale queued jobs from previous runs can continue after rebuild starts.
    await this.removeQueuedJobsForBook(book.id, null)

    const jobId = await this.bookImportOrchestratorService.scheduleImportPipeline({
      bookId: book.id,
      userId,
    })

    return {
      bookId: book.id,
      jobId,
      status: 'queued',
    }
  }

  private async clearBookAudioFiles(bookId: number, audioUrl: string | null) {
    const pathsResult = await BookChapterAudio.query()
      .where('bookId', bookId)
      .whereNotNull('audioPath')
      .select('audioPath')

    const chapterAudioPaths = pathsResult
      .map((item) => item.audioPath)
      .filter((path): path is string => Boolean(path))

    const paths = new Set<string>([
      `book/voices/${bookId}.mp3`,
      ...(audioUrl ? [audioUrl] : []),
      ...chapterAudioPaths,
    ])

    for (const path of paths) {
      try {
        const exists = await drive.use().exists(path)
        if (!exists) {
          continue
        }
        await drive.use().delete(path)
      } catch (error) {
        logger.warn(
          {
            bookId,
            audioPath: path,
            err: error,
          },
          'Failed to delete stale book audio file'
        )
      }
    }
  }

  async stopImport(bookId: number, userId: number) {
    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    if (book.status !== 'processing') {
      throw new Exception('Book is not processing', { status: 400 })
    }

    const now = DateTime.now()
    const errorMessage = `Import stopped manually by user ${userId}`
    let stoppedRunId: number | null = null

    await db.transaction(async (trx) => {
      const activeRun = await BookProcessingRunLog.query({ client: trx })
        .where('bookId', book.id)
        .where('jobType', 'import')
        .where('status', 'processing')
        .orderBy('id', 'desc')
        .first()

      if (activeRun) {
        stoppedRunId = activeRun.id
        const nextMetadata: Record<string, unknown> = {
          ...(activeRun.metadata || {}),
          cancelRequestedAt: now.toISO(),
          cancelledBy: userId,
          cancelFromStep: activeRun.currentStep,
          cancelReason: 'manual_stop',
        }

        activeRun.useTransaction(trx).merge({
          status: 'failed',
          currentStep: BOOK_IMPORT_STEP.FAILED,
          finishedAt: now,
          durationMs: activeRun.startedAt ? now.toMillis() - activeRun.startedAt.toMillis() : null,
          errorCode: 'USER_ABORTED',
          errorMessage,
          metadata: nextMetadata,
        })
        await activeRun.save()

        await db
          .from('book_processing_step_logs')
          .where('run_log_id', activeRun.id)
          .where('status', 'processing')
          .update({
            status: 'failed',
            finished_at: now.toSQL(),
            error_code: 'USER_ABORTED',
            error_message: errorMessage,
            updated_at: now.toSQL(),
          })
      }

      await book
        .useTransaction(trx)
        .merge({
          status: 'cancelled',
          processingStep: BOOK_IMPORT_STEP.FAILED,
          processingProgress: 100,
          processingError: errorMessage,
          audioStatus: book.audioStatus === 'processing' ? 'failed' : book.audioStatus,
          vocabularyStatus:
            book.vocabularyStatus === 'processing' ? 'failed' : book.vocabularyStatus,
        })
        .save()
    })

    const activeRunId = await BookProcessingRunLog.query()
      .where('bookId', book.id)
      .where('jobType', 'import')
      .orderBy('id', 'desc')
      .first()

    const removedQueuedJobs = await this.removeQueuedJobsForBook(book.id, activeRunId?.id ?? null)

    if (stoppedRunId) {
      const stoppedRun = await BookProcessingRunLog.find(stoppedRunId)
      if (stoppedRun) {
        await stoppedRun
          .merge({
            metadata: {
              ...(stoppedRun.metadata || {}),
              removedQueuedJobs,
              queueCleanupAt: DateTime.now().toISO(),
            },
          })
          .save()
      }
    }

    return {
      bookId: book.id,
      status: 'stopped',
      runId: stoppedRunId,
      removedQueuedJobs,
    }
  }

  async continueImport(bookId: number, userId: number) {
    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    if (book.status === 'processing') {
      throw new Exception('Book is already processing', { status: 400 })
    }

    if (book.status === 'ready') {
      throw new Exception('Book import is already completed', { status: 400 })
    }

    const chapterCountResult = await BookChapter.query()
      .where('bookId', book.id)
      .count('* as total')
      .firstOrFail()
    const chapterCount = Number(chapterCountResult.$extras.total || 0)

    if (chapterCount === 0) {
      throw new Exception('No chapters found, use rebuild instead of continue', { status: 400 })
    }

    const allAudioReady = await this.areAllChaptersReady(book.id)
    const vocabularyCompleted = book.vocabularyStatus === 'completed'

    const resumeStep =
      allAudioReady && vocabularyCompleted
        ? BOOK_IMPORT_STEP.FINALIZE_IMPORT
        : vocabularyCompleted
          ? BOOK_IMPORT_STEP.GENERATE_TTS
          : BOOK_IMPORT_STEP.ENRICH_VOCABULARY

    const previousStep =
      resumeStep === BOOK_IMPORT_STEP.FINALIZE_IMPORT
        ? BOOK_IMPORT_STEP.GENERATE_TTS
        : resumeStep === BOOK_IMPORT_STEP.GENERATE_TTS
          ? BOOK_IMPORT_STEP.ENRICH_VOCABULARY
          : BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED

    const previousProgress = BookImportOrchestratorService.getBaseProgressByStep(previousStep)

    await this.removeQueuedJobsForBook(book.id, null)

    const run = await db.transaction(async (trx) => {
      const runLog = await BookProcessingRunLog.create(
        {
          bookId: book.id,
          jobType: 'import',
          status: 'processing',
          currentStep: previousStep,
          progress: previousProgress,
          startedAt: DateTime.now(),
          metadata: {
            resumeRequestedAt: DateTime.now().toISO(),
            resumeRequestedBy: userId,
            resumeStep,
            continueMode: 'resume_remaining_pipeline',
          },
        },
        { client: trx }
      )

      await book
        .useTransaction(trx)
        .merge({
          status: 'processing',
          processingStep: previousStep,
          processingProgress: previousProgress,
          processingError: null,
        })
        .save()

      return runLog
    })

    const jobId = await this.bookImportOrchestratorService.scheduleImportPipelineFromStep({
      bookId: book.id,
      userId,
      runId: run.id,
      stepKey: resumeStep,
    })

    return {
      bookId: book.id,
      runId: run.id,
      status: 'queued',
      jobId,
      resumeStep,
    }
  }

  private async removeQueuedJobsForBook(bookId: number, runId: number | null): Promise<number> {
    type QueueJob = { id?: string | number; data: unknown; remove: () => Promise<void> }
    type QueueLike = {
      getJobs: (
        statuses: string[],
        start?: number,
        end?: number,
        asc?: boolean
      ) => Promise<QueueJob[]>
    }

    const queues = (await app.container.make('jobs.queues')) as Record<string, QueueLike>
    const statuses = ['waiting', 'delayed', 'paused', 'prioritized', 'waiting-children'] as const
    let removed = 0

    for (const queue of Object.values(queues)) {
      const queuedJobs = await queue.getJobs([...statuses], 0, 2000, true)
      for (const job of queuedJobs) {
        const payload = this.decodeJobPayload(job.data)
        if (!payload) {
          continue
        }

        const payloadBookId = payload.bookId
        const rawPayload = typeof payload.__raw === 'string' ? payload.__raw : ''
        const rawPayloadMatches =
          rawPayload.includes(`\"bookId\":${bookId}`) ||
          rawPayload.includes(`\"bookId\": ${bookId}`) ||
          rawPayload.includes(`bookId:${bookId}`) ||
          rawPayload.includes(`bookId: ${bookId}`)

        const idText = String(job.id ?? '')
        const runScopedIdPrefix = runId ? `import-run-${runId}-book-${bookId}-step-` : ''
        const idMatches = runScopedIdPrefix ? idText.startsWith(runScopedIdPrefix) : false

        if (
          (typeof payloadBookId === 'number' && payloadBookId === bookId) ||
          rawPayloadMatches ||
          idMatches
        ) {
          await job.remove()
          removed++
        }
      }
    }

    return removed
  }

  private decodeJobPayload(data: unknown): Record<string, unknown> | null {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data)
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>
        }
      } catch {
        // fallthrough
      }

      return { __raw: data }
    }

    if (data && typeof data === 'object') {
      return data as Record<string, unknown>
    }

    return null
  }
}
