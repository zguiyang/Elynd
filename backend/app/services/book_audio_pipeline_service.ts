import { inject } from '@adonisjs/core'
import { createHash } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import { TtsService } from '#services/tts_service'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookImportOrchestratorService } from '#services/book_import_orchestrator_service'
import { ImportStateService } from '#services/import_state_service'
import FinalizeImportJob from '#jobs/finalize_import_job'
import type { SerialImportPayload } from '#types/book_import_pipeline'
import type { ChapterInput, WordTiming } from '#types/tts'

const DEFAULT_VOICE_HASH = 'default-voice'
const MIN_WORD_BOUNDARIES = 20
const HEAD_WORD_MATCH_SIZE = 30
const HEAD_WORD_MATCH_RATE_MIN = 0.8
const WORD_RATIO_MIN = 0.5
const WORD_RATIO_MAX = 1.6

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
      await this.importStateService.assertImportNotCancelled(runId, bookId)
      const chapters = await BookChapter.query()
        .where('bookId', bookId)
        .orderBy('chapterIndex', 'asc')
      const aggregatedWords: Array<WordTiming & { chapterIndex: number }> = []
      let cumulativeOffset = 0
      for (const chapter of chapters) {
        await this.importStateService.assertImportNotCancelled(runId, bookId)

        const chapterInput: ChapterInput = {
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
          content: chapter.content,
        }
        this.assertTtsInput(chapterInput)
        const generated = await this.ttsService.generateChapterAudio(chapterInput, bookId, {
          beforeChunkSynthesis: async () => {
            await this.importStateService.assertImportNotCancelled(runId, bookId)
          },
        })
        await this.importStateService.assertImportNotCancelled(runId, bookId)
        this.assertWordTimings(chapterInput, generated.timing.words)
        const textHash = this.computeTextHash(chapter.title, chapter.content)

        for (const item of generated.timing.words) {
          aggregatedWords.push({
            ...item,
            chapterIndex: chapter.chapterIndex,
            audioOffset: item.audioOffset + cumulativeOffset,
          })
        }
        cumulativeOffset += generated.duration

        const existing = await BookChapterAudio.query()
          .where('bookId', bookId)
          .where('chapterIndex', chapter.chapterIndex)
          .first()

        if (existing) {
          await existing
            .merge({
              textHash,
              voiceHash: DEFAULT_VOICE_HASH,
              audioPath: generated.audioPath,
              durationMs: generated.duration,
              status: 'completed',
              errorMessage: null,
            })
            .save()
        } else {
          await BookChapterAudio.create({
            bookId,
            chapterIndex: chapter.chapterIndex,
            textHash,
            voiceHash: DEFAULT_VOICE_HASH,
            audioPath: generated.audioPath,
            durationMs: generated.duration,
            status: 'completed',
            errorMessage: null,
          })
        }
      }
      await this.importStateService.assertImportNotCancelled(runId, bookId)

      const chapterAudios = await BookChapterAudio.query()
        .where('bookId', bookId)
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
        { chapterCount: chapterAudios.length, totalDuration, wordsCount: aggregatedWords.length }
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
    const normalizedTitle = title
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+/g, ' ')
      .toLowerCase()
    const normalizedContent = content
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()

    return createHash('sha256')
      .update(`${normalizedTitle}\n${normalizedContent}`, 'utf-8')
      .digest('hex')
  }

  private assertTtsInput(chapter: ChapterInput) {
    const content = chapter.content
    if (!content.trim()) {
      throw new Error(`Invalid TTS input for chapter ${chapter.chapterIndex}: empty_content`)
    }

    if (this.hasHtmlResidue(content)) {
      throw new Error(
        `Invalid TTS input for chapter ${chapter.chapterIndex}: html_or_epub_residue_detected`
      )
    }

    if (this.hasMarkdownResidue(content)) {
      throw new Error(
        `Invalid TTS input for chapter ${chapter.chapterIndex}: markdown_residue_detected`
      )
    }

    const firstLine =
      content
        .split('\n')
        .find((line) => line.trim().length > 0)
        ?.trim() || ''
    if (this.isSameTitle(firstLine, chapter.title)) {
      throw new Error(
        `Invalid TTS input for chapter ${chapter.chapterIndex}: duplicated_leading_title`
      )
    }
  }

  private assertWordTimings(chapter: ChapterInput, words: WordTiming[]) {
    if (words.length < MIN_WORD_BOUNDARIES) {
      logger.warn(
        {
          chapterIndex: chapter.chapterIndex,
          wordsCount: words.length,
          minRequired: MIN_WORD_BOUNDARIES,
        },
        'TTS validation failed: insufficient word boundaries'
      )
      throw new Error(
        `Invalid TTS output for chapter ${chapter.chapterIndex}: words_missing(${words.length})`
      )
    }

    const expectedWords = this.extractWords(chapter.content)
    const actualWords = words.map((item) => this.normalizeToken(item.word)).filter(Boolean)

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
      .split(/\s+/)
      .map((token) => this.normalizeToken(token))
      .filter(Boolean)
  }

  private normalizeToken(token: string): string {
    return token
      .toLowerCase()
      .replace(/[^a-z0-9']/g, '')
      .trim()
  }

  private hasHtmlResidue(content: string): boolean {
    return /<[^>]+>/.test(content) || /<\/?[a-z][^>\n]*(?=\n|$)/i.test(content)
  }

  private hasMarkdownResidue(content: string): boolean {
    return (
      /^\s{0,3}#{1,6}\s+/m.test(content) ||
      /```/.test(content) ||
      /^\s*[-*+]\s+/m.test(content) ||
      /^\s*\d+\.\s+/m.test(content) ||
      /!\[[^\]]*\]\([^)]+\)/.test(content) ||
      /\[[^\]]+\]\([^)]+\)/.test(content)
    )
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
