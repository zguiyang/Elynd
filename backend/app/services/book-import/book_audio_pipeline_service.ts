import { inject } from '@adonisjs/core'
import { createHash } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import { TtsService } from '#services/shared/tts_service'
import { BOOK_IMPORT_STEP, TTS_CHUNK_STRATEGY } from '#constants'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import { ImportStateService } from '#services/book-import/import_state_service'
import FinalizeImportJob from '#jobs/finalize_import_job'
import type { SerialImportPayload } from '#types/book_import_pipeline'
import type { ChapterInput, WordTiming } from '#types/tts'
import {
  buildCanonicalChapterText,
  hasHtmlResidue,
  hasMarkdownResidue,
} from '#services/book-parse/book_text_normalizer'

const MIN_WORD_BOUNDARIES = 20
const HEAD_WORD_MATCH_SIZE = 30
const HEAD_WORD_MATCH_RATE_MIN = 0.8
const WORD_RATIO_MIN = 0.5
const WORD_RATIO_MAX = 1.6

type ChapterMetric = {
  chapterIndex: number
  textLength: number
  chunkCount: number
  chapterElapsedMs: number
  audioDurationMs: number
  rft: number | null
  errorCode: string | null
  reused: boolean
}

@inject()
export class BookAudioPipelineService {
  constructor(
    private ttsService: TtsService,
    private importStateService: ImportStateService
  ) {}

  async run(payload: SerialImportPayload) {
    const { bookId, runId, userId } = payload
    const book = await Book.findOrFail(bookId)
    await this.importStateService.assertImportNotCancelled(runId, bookId)
    const progress = BookImportOrchestratorService.getBaseProgressByStep(
      BOOK_IMPORT_STEP.GENERATE_TTS
    )
    const step = await this.importStateService.startStep(
      runId,
      bookId,
      BOOK_IMPORT_STEP.GENERATE_TTS,
      progress
    )

    await book.merge({ audioStatus: 'processing' }).save()

    try {
      logger.info(
        { bookId, runId, stepKey: BOOK_IMPORT_STEP.GENERATE_TTS },
        '[AudioPipeline] Step run started'
      )
      await this.importStateService.assertImportNotCancelled(runId, bookId)
      const chapters = await BookChapter.query()
        .where('bookId', bookId)
        .orderBy('chapterIndex', 'asc')
      const aggregatedWords: Array<WordTiming & { chapterIndex: number }> = []
      const chapterAudios: Array<{ chapterIndex: number; audioPath: string; durationMs: number }> =
        []
      const chapterMetrics: ChapterMetric[] = []
      const voiceHash = this.computeVoiceHash(this.ttsService.getCurrentVoiceName())
      let cumulativeOffset = 0

      for (const chapter of chapters) {
        await this.importStateService.assertImportNotCancelled(runId, bookId)
        const chapterStartAt = Date.now()

        const chapterInput: ChapterInput = {
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
          content: chapter.content,
        }

        this.assertTtsInput(chapterInput)
        const textHash = this.computeTextHash(chapter.title, chapter.content)
        await this.importStateService.assertImportNotCancelled(runId, bookId)

        const cacheHit = await this.findReusableChapterAudio(
          bookId,
          chapter.chapterIndex,
          textHash,
          voiceHash
        )

        if (!cacheHit) {
          logger.info(
            {
              bookId,
              chapterIndex: chapter.chapterIndex,
              textHash,
              voiceHash,
              reason: 'no_matching_completed_cache_record',
            },
            'TTS cache lookup miss'
          )
        }

        if (cacheHit && (cacheHit.timingWords?.length || 0) > 0) {
          logger.info(
            {
              bookId,
              chapterIndex: chapter.chapterIndex,
              textHash,
              voiceHash,
              cachedAudioPath: cacheHit.audioPath,
              cachedDurationMs: cacheHit.durationMs,
              cachedChunkCount: cacheHit.chunkCount,
              cachedTimingWordsCount: cacheHit.timingWords?.length || 0,
              cacheStatus: cacheHit.status,
            },
            'TTS cache lookup hit'
          )
          await this.importStateService.assertImportNotCancelled(runId, bookId)
          const words = cacheHit.timingWords || []
          this.assertWordTimings(chapterInput, words)
          this.appendAggregatedWords(aggregatedWords, chapter.chapterIndex, words, cumulativeOffset)
          cumulativeOffset += cacheHit.durationMs || 0
          chapterAudios.push({
            chapterIndex: chapter.chapterIndex,
            audioPath: cacheHit.audioPath || '',
            durationMs: cacheHit.durationMs || 0,
          })
          const elapsedMs = Date.now() - chapterStartAt
          const rft = this.computeRft(elapsedMs, cacheHit.durationMs)

          chapterMetrics.push({
            chapterIndex: chapter.chapterIndex,
            textLength: chapterInput.content.length,
            chunkCount: cacheHit.chunkCount || 0,
            chapterElapsedMs: elapsedMs,
            audioDurationMs: cacheHit.durationMs || 0,
            rft,
            errorCode: null,
            reused: true,
          })

          logger.info(
            {
              bookId,
              chapterIndex: chapter.chapterIndex,
              textLength: chapterInput.content.length,
              chunkCount: cacheHit.chunkCount,
              chapterElapsedMs: elapsedMs,
              audioDurationMs: cacheHit.durationMs,
              rft,
              cacheHit: true,
              chunkerVersion: TTS_CHUNK_STRATEGY.CHUNKER_VERSION,
            },
            'Chapter audio reused from cache'
          )

          await this.importStateService.assertImportNotCancelled(runId, bookId)
          continue
        }

        if (cacheHit && (!cacheHit.timingWords || cacheHit.timingWords.length === 0)) {
          logger.info(
            {
              bookId,
              chapterIndex: chapter.chapterIndex,
              textHash,
              voiceHash,
              cachedAudioPath: cacheHit.audioPath,
              cachedDurationMs: cacheHit.durationMs,
              cachedChunkCount: cacheHit.chunkCount,
              cacheStatus: cacheHit.status,
              reason: 'timing_words_missing',
            },
            'Skip cache reuse because timing words are missing; fallback to synthesis'
          )
        }

        try {
          const generated = await this.ttsService.generateChapterAudio(chapterInput, bookId, {
            beforeChunkSynthesis: async () => {
              await this.importStateService.assertImportNotCancelled(runId, bookId)
            },
          })

          await this.importStateService.assertImportNotCancelled(runId, bookId)
          this.assertWordTimings(chapterInput, generated.timing.words)
          this.appendAggregatedWords(
            aggregatedWords,
            chapter.chapterIndex,
            generated.timing.words,
            cumulativeOffset
          )
          cumulativeOffset += generated.duration
          chapterAudios.push({
            chapterIndex: chapter.chapterIndex,
            audioPath: generated.audioPath,
            durationMs: generated.duration,
          })

          await this.importStateService.assertImportNotCancelled(runId, bookId)
          await this.upsertChapterAudio({
            bookId,
            chapterIndex: chapter.chapterIndex,
            textHash,
            voiceHash,
            audioPath: generated.audioPath,
            durationMs: generated.duration,
            timingWords: generated.timing.words,
            chunkCount: generated.chunkCount,
            status: TTS_CHUNK_STRATEGY.REUSE_AUDIO_STATUS,
            errorCode: null,
            errorMessage: null,
          })
          await this.importStateService.assertImportNotCancelled(runId, bookId)

          const elapsedMs = Date.now() - chapterStartAt
          const rft = this.computeRft(elapsedMs, generated.duration)

          chapterMetrics.push({
            chapterIndex: chapter.chapterIndex,
            textLength: chapterInput.content.length,
            chunkCount: generated.chunkCount,
            chapterElapsedMs: elapsedMs,
            audioDurationMs: generated.duration,
            rft,
            errorCode: null,
            reused: false,
          })

          logger.info(
            {
              bookId,
              chapterIndex: chapter.chapterIndex,
              textLength: chapterInput.content.length,
              chunkCount: generated.chunkCount,
              chapterElapsedMs: elapsedMs,
              audioDurationMs: generated.duration,
              rft,
              cacheHit: false,
              chunkerVersion: TTS_CHUNK_STRATEGY.CHUNKER_VERSION,
            },
            'Chapter TTS metrics'
          )
        } catch (error) {
          const elapsedMs = Date.now() - chapterStartAt
          const errorCode = this.extractErrorCode(error)
          logger.warn(
            {
              bookId,
              chapterIndex: chapter.chapterIndex,
              textLength: chapterInput.content.length,
              chunkCount: 0,
              chapterElapsedMs: elapsedMs,
              audioDurationMs: 0,
              rft: null,
              errorCode,
              cacheHit: false,
            },
            'Chapter TTS metrics (failed)'
          )
          chapterMetrics.push({
            chapterIndex: chapter.chapterIndex,
            textLength: chapterInput.content.length,
            chunkCount: 0,
            chapterElapsedMs: elapsedMs,
            audioDurationMs: 0,
            rft: null,
            errorCode,
            reused: false,
          })

          await this.upsertChapterAudio({
            bookId,
            chapterIndex: chapter.chapterIndex,
            textHash,
            voiceHash,
            audioPath: null,
            durationMs: null,
            timingWords: null,
            chunkCount: null,
            status: 'failed',
            errorCode,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
          throw error
        }
      }

      await this.importStateService.assertImportNotCancelled(runId, bookId)
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
            words: aggregatedWords,
            totalDuration,
          },
        })
        .save()
      await this.importStateService.assertImportNotCancelled(runId, bookId)

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.GENERATE_TTS,
        progress,
        {
          chapterCount: chapterAudios.length,
          totalDuration,
          wordsCount: aggregatedWords.length,
          chunkerVersion: TTS_CHUNK_STRATEGY.CHUNKER_VERSION,
          chapterMetrics,
        }
      )
      logger.info(
        {
          bookId,
          runId,
          stepKey: BOOK_IMPORT_STEP.GENERATE_TTS,
          chapterCount: chapterAudios.length,
          reusedCount: chapterMetrics.filter((item) => item.reused).length,
          generatedCount: chapterMetrics.filter((item) => !item.reused).length,
        },
        '[AudioPipeline] Step run completed'
      )

      await FinalizeImportJob.dispatch(
        { bookId, runId, userId },
        {
          jobId: BookImportOrchestratorService.buildPipelineJobId({
            runId,
            bookId,
            stepKey: BOOK_IMPORT_STEP.FINALIZE_IMPORT,
          }),
        }
      )
    } catch (error) {
      if (ImportStateService.isImportCancelledError(error)) {
        await book.refresh()
        if (book.audioStatus === 'processing') {
          await book.merge({ audioStatus: 'pending' }).save()
        }
        return
      }
      logger.error(
        { bookId, runId, stepKey: BOOK_IMPORT_STEP.GENERATE_TTS, err: error },
        '[AudioPipeline] Step run failed'
      )
      await book.merge({ audioStatus: 'failed' }).save()
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.importStateService.failStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.GENERATE_TTS,
        message
      )
      throw error
    }
  }

  private computeTextHash(title: string, content: string): string {
    const normalized = buildCanonicalChapterText(title, content)

    return createHash('sha256')
      .update(normalized, 'utf-8')
      .digest('hex')
  }

  private computeVoiceHash(voiceName: string): string {
    return createHash('sha256')
      .update(`azure_tts:${voiceName}:${TTS_CHUNK_STRATEGY.CHUNKER_VERSION}`, 'utf-8')
      .digest('hex')
  }

  private async findReusableChapterAudio(
    bookId: number,
    chapterIndex: number,
    textHash: string,
    voiceHash: string
  ) {
    return await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('chapterIndex', chapterIndex)
      .where('textHash', textHash)
      .where('voiceHash', voiceHash)
      .where('status', TTS_CHUNK_STRATEGY.REUSE_AUDIO_STATUS)
      .whereNotNull('audioPath')
      .whereNotNull('durationMs')
      .first()
  }

  private appendAggregatedWords(
    aggregatedWords: Array<WordTiming & { chapterIndex: number }>,
    chapterIndex: number,
    words: WordTiming[],
    cumulativeOffset: number
  ) {
    for (const item of words) {
      aggregatedWords.push({
        ...item,
        chapterIndex,
        audioOffset: item.audioOffset + cumulativeOffset,
      })
    }
  }

  private computeRft(chapterElapsedMs: number, audioDurationMs: number | null) {
    if (!audioDurationMs || audioDurationMs <= 0) {
      return null
    }
    return Number((chapterElapsedMs / audioDurationMs).toFixed(3))
  }

  private async upsertChapterAudio(payload: {
    bookId: number
    chapterIndex: number
    textHash: string
    voiceHash: string
    audioPath: string | null
    durationMs: number | null
    timingWords: WordTiming[] | null
    chunkCount: number | null
    status: 'pending' | 'processing' | 'completed' | 'failed'
    errorCode: string | null
    errorMessage: string | null
  }) {
    const existing = await BookChapterAudio.query()
      .where('bookId', payload.bookId)
      .where('chapterIndex', payload.chapterIndex)
      .where('textHash', payload.textHash)
      .where('voiceHash', payload.voiceHash)
      .first()

    if (existing) {
      await existing.merge(payload).save()
      return
    }

    await BookChapterAudio.create(payload)
  }

  private extractErrorCode(error: unknown) {
    if (ImportStateService.isImportCancelledError(error)) {
      return 'import_cancelled'
    }

    if (typeof error === 'object' && error && 'ttsError' in error) {
      const ttsError = (error as { ttsError?: { code?: string } }).ttsError
      if (ttsError?.code) {
        return ttsError.code
      }
    }

    if (error instanceof Error) {
      const matchedCode = error.message.match(/:\s*([a-z_]+)(?:\(|$)/i)
      if (matchedCode?.[1]) {
        return matchedCode[1].toLowerCase()
      }
    }

    return 'unknown'
  }

  private assertTtsInput(chapter: ChapterInput) {
    const canonicalText = buildCanonicalChapterText(chapter.title, chapter.content)
    if (!canonicalText.trim()) {
      throw new Error(`Invalid TTS input for chapter ${chapter.chapterIndex}: empty_content`)
    }

    if (hasHtmlResidue(canonicalText)) {
      throw new Error(
        `Invalid TTS input for chapter ${chapter.chapterIndex}: html_or_epub_residue_detected`
      )
    }

    if (hasMarkdownResidue(canonicalText)) {
      throw new Error(
        `Invalid TTS input for chapter ${chapter.chapterIndex}: markdown_residue_detected`
      )
    }

    const body = canonicalText.split(/\n\s*\n/).slice(1).join('\n\n')
    const firstBodyLine =
      body
        .split('\n')
        .find((line) => line.trim().length > 0)
        ?.trim() || ''
    if (this.isSameTitle(firstBodyLine, chapter.title)) {
      throw new Error(
        `Invalid TTS input for chapter ${chapter.chapterIndex}: duplicated_leading_title`
      )
    }
  }

  private assertWordTimings(chapter: ChapterInput, words: WordTiming[]) {
    const expectedWords = this.extractWords(buildCanonicalChapterText(chapter.title, chapter.content))
    const minRequiredWords =
      expectedWords.length >= MIN_WORD_BOUNDARIES ? MIN_WORD_BOUNDARIES : Math.max(1, expectedWords.length)

    if (words.length < minRequiredWords) {
      logger.warn(
        {
          chapterIndex: chapter.chapterIndex,
          wordsCount: words.length,
          minRequired: minRequiredWords,
        },
        'TTS validation failed: insufficient word boundaries'
      )
      throw new Error(
        `Invalid TTS output for chapter ${chapter.chapterIndex}: words_missing(${words.length})`
      )
    }

    const actualWords = words.flatMap((item) => this.extractWords(item.word))

    const compareCount = Math.min(HEAD_WORD_MATCH_SIZE, expectedWords.length, actualWords.length)
    if (compareCount === 0) {
      logger.warn(
        {
          chapterIndex: chapter.chapterIndex,
          expectedWordCount: expectedWords.length,
          actualWordCount: actualWords.length,
        },
        'TTS validation failed: empty compare window after normalization'
      )
      throw new Error(
        `Invalid TTS output for chapter ${chapter.chapterIndex}: head_words_empty_after_normalization`
      )
    }

    const headMatchResult = this.computeBestHeadMatch(expectedWords, actualWords, compareCount)
    const headMatchRate = headMatchResult.rate
    const expectedHeadPreview = expectedWords.slice(0, compareCount).join(' ')
    const actualHeadPreview = actualWords
      .slice(headMatchResult.shift, headMatchResult.shift + compareCount)
      .join(' ')

    logger.info(
      {
        chapterIndex: chapter.chapterIndex,
        compareCount,
        matched: headMatchResult.matched,
        headMatchRate: Number(headMatchRate.toFixed(3)),
        bestShift: headMatchResult.shift,
        expectedHeadPreview,
        actualHeadPreview,
      },
      'TTS head-match diagnostics'
    )

    if (headMatchRate < HEAD_WORD_MATCH_RATE_MIN) {
      logger.warn(
        {
          chapterIndex: chapter.chapterIndex,
          headMatchRate: Number(headMatchRate.toFixed(3)),
          threshold: HEAD_WORD_MATCH_RATE_MIN,
          bestShift: headMatchResult.shift,
          expectedHeadPreview,
          actualHeadPreview,
        },
        'TTS validation failed: head mismatch'
      )
      throw new Error(
        `Invalid TTS output for chapter ${chapter.chapterIndex}: head_mismatch(rate=${headMatchRate.toFixed(2)})`
      )
    }

    const ratio = actualWords.length / Math.max(expectedWords.length, 1)
    if (ratio < WORD_RATIO_MIN || ratio > WORD_RATIO_MAX) {
      logger.warn(
        {
          chapterIndex: chapter.chapterIndex,
          ratio: Number(ratio.toFixed(3)),
          min: WORD_RATIO_MIN,
          max: WORD_RATIO_MAX,
          expectedWordCount: expectedWords.length,
          actualWordCount: actualWords.length,
        },
        'TTS validation failed: abnormal words ratio'
      )
      throw new Error(
        `Invalid TTS output for chapter ${chapter.chapterIndex}: words_ratio_abnormal(${ratio.toFixed(2)})`
      )
    }
  }

  private computeBestHeadMatch(
    expectedWords: string[],
    actualWords: string[],
    compareCount: number
  ): { rate: number; shift: number; matched: number } {
    const maxShift = Math.min(12, Math.max(actualWords.length - compareCount, 0))
    let bestRate = 0
    let bestShift = 0
    let bestMatched = 0

    for (let shift = 0; shift <= maxShift; shift++) {
      let matched = 0
      for (let i = 0; i < compareCount; i++) {
        if (expectedWords[i] === actualWords[i + shift]) {
          matched++
        }
      }
      const rate = matched / compareCount
      if (rate > bestRate) {
        bestRate = rate
        bestShift = shift
        bestMatched = matched
      }
    }

    return {
      rate: bestRate,
      shift: bestShift,
      matched: bestMatched,
    }
  }

  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/([a-z0-9])\-([a-z0-9])/g, '$1$2')
      .replace(/[—–]/g, ' ')
      .replace(/[^a-z0-9']+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
  }

  private isSameTitle(line: string, title: string): boolean {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    return normalize(line) === normalize(title)
  }
}
