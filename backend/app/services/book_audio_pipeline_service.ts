import { inject } from '@adonisjs/core'
import { createHash } from 'node:crypto'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import { TtsService } from '#services/tts_service'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookImportOrchestratorService } from '#services/book_import_orchestrator_service'
import { ImportStateService } from '#services/import_state_service'
import FinalizeImportJob from '#jobs/finalize_import_job'
import type { SerialImportPayload } from '#types/book_import_pipeline'
import type { ChapterInput } from '#types/tts'

const DEFAULT_VOICE_HASH = 'default-voice'

@inject()
export class BookAudioPipelineService {
  constructor(
    private ttsService: TtsService,
    private importStateService: ImportStateService
  ) {}

  async run(payload: SerialImportPayload) {
    const { bookId, runId, userId } = payload
    const book = await Book.findOrFail(bookId)
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
      const chapters = await BookChapter.query()
        .where('bookId', bookId)
        .orderBy('chapterIndex', 'asc')
      for (const chapter of chapters) {
        await book.refresh()
        if (book.status !== 'processing') {
          throw new Error(`Import stopped for book ${bookId}`)
        }

        const textHash = this.computeTextHash(chapter.content)
        const existingAudio = await BookChapterAudio.query()
          .where('bookId', bookId)
          .where('chapterIndex', chapter.chapterIndex)
          .where('textHash', textHash)
          .where('voiceHash', DEFAULT_VOICE_HASH)
          .where('status', 'completed')
          .first()

        if (existingAudio) {
          continue
        }

        const chapterInput: ChapterInput = {
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
          content: chapter.content,
        }
        const generated = await this.ttsService.generateChapterAudio(chapterInput, bookId)

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
            totalDuration,
          },
        })
        .save()

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.GENERATE_TTS,
        progress,
        { chapterCount: chapterAudios.length, totalDuration }
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

  private computeTextHash(content: string): string {
    const normalized = content
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()

    return createHash('sha256').update(normalized, 'utf-8').digest('hex')
  }
}
