import { inject } from '@adonisjs/core'
import { dispatch } from 'adonisjs-jobs/services/main'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import BookVocabulary from '#models/book_vocabulary'
import BookProcessingStepLog from '#models/book_processing_step_log'
import { BookParserService } from '#services/book-parse/book_parser_service'
import { BookSemanticCleanService } from '#services/book-parse/book_semantic_clean_service'
import { VocabularyAnalyzerService } from '#services/book-parse/vocabulary_analyzer_service'
import { BookHashService } from '#services/book-parse/book_hash_service'
import { BookContentGuardService } from '#services/book-parse/book_content_guard_service'
import { BookLevelService } from '#services/book/book_level_service'
import GenerateBookAudioJob from '#jobs/generate_book_audio_job'
import GenerateBookVocabularyJob from '#jobs/generate_book_vocabulary_job'
import { BOOK_IMPORT_PROGRESS, BOOK_IMPORT_STEP } from '#constants'

export interface ParsedSourceResult {
  title: string
  author: string | null
  description: string | null
  chapters: Array<{ title: string; content: string; chapterIndex: number }>
  wordCount: number
}

export interface ChapterArtifactItem {
  title: string
  content: string
  chapterIndex: number
}

type DispatchableImportStep =
  | typeof BOOK_IMPORT_STEP.PREPARE_IMPORT
  | typeof BOOK_IMPORT_STEP.SEMANTIC_CLEAN
  | typeof BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT
  | typeof BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED
  | typeof BOOK_IMPORT_STEP.ENRICH_VOCABULARY
  | typeof BOOK_IMPORT_STEP.GENERATE_TAGS
  | typeof BOOK_IMPORT_STEP.GENERATE_TTS
  | typeof BOOK_IMPORT_STEP.FINALIZE_IMPORT

@inject()
export class BookImportOrchestratorService {
  constructor(
    private parserService: BookParserService,
    private analyzerService: VocabularyAnalyzerService,
    private hashService: BookHashService,
    private guardService: BookContentGuardService,
    private semanticCleaner: BookSemanticCleanService,
    private bookLevelService: BookLevelService
  ) {}

  static getBaseProgressByStep(step: string): number {
    const weights: Array<{ key: string; weight: number }> = [
      { key: BOOK_IMPORT_STEP.PREPARE_IMPORT, weight: BOOK_IMPORT_PROGRESS.PREPARE_IMPORT },
      { key: BOOK_IMPORT_STEP.SEMANTIC_CLEAN, weight: BOOK_IMPORT_PROGRESS.SEMANTIC_CLEAN },
      {
        key: BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT,
        weight: BOOK_IMPORT_PROGRESS.VALIDATE_CHAPTER_CONTENT,
      },
      {
        key: BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
        weight: BOOK_IMPORT_PROGRESS.BUILD_CONTENT_AND_VOCAB_SEED,
      },
      { key: BOOK_IMPORT_STEP.ENRICH_VOCABULARY, weight: BOOK_IMPORT_PROGRESS.ENRICH_VOCABULARY },
      { key: BOOK_IMPORT_STEP.GENERATE_TAGS, weight: BOOK_IMPORT_PROGRESS.GENERATE_TAGS },
      { key: BOOK_IMPORT_STEP.GENERATE_TTS, weight: BOOK_IMPORT_PROGRESS.GENERATE_TTS },
      { key: BOOK_IMPORT_STEP.FINALIZE_IMPORT, weight: BOOK_IMPORT_PROGRESS.FINALIZE_IMPORT },
    ]

    let total = 0
    for (const item of weights) {
      total += item.weight
      if (item.key === step) {
        return total
      }
    }

    return 0
  }

  static buildPipelineJobId(params: { runId: number; bookId: number; stepKey: string }): string {
    const { runId, bookId, stepKey } = params
    return `import-run-${runId}-book-${bookId}-step-${stepKey}`
  }

  async scheduleImportPipeline(payload: { bookId: number; userId: number }) {
    const { default: ProcessBookJob } = await import('#jobs/process_book_job')
    const jobId = (await dispatch(ProcessBookJob, payload)) as string | undefined
    return jobId || `manual-import-${Date.now()}`
  }

  async scheduleImportPipelineFromStep(payload: {
    bookId: number
    userId: number
    runId: number
    stepKey: DispatchableImportStep
  }) {
    const { bookId, userId, runId, stepKey } = payload
    const commonPayload = { bookId, userId, runId }
    const jobId = BookImportOrchestratorService.buildPipelineJobId({
      runId,
      bookId,
      stepKey,
    })

    switch (stepKey) {
      case BOOK_IMPORT_STEP.PREPARE_IMPORT: {
        const { default: PrepareImportJob } = await import('#jobs/prepare_import_job')
        return (
          ((await dispatch(PrepareImportJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      case BOOK_IMPORT_STEP.SEMANTIC_CLEAN: {
        const { default: SemanticCleanJob } = await import('#jobs/semantic_clean_job')
        return (
          ((await dispatch(SemanticCleanJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      case BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT: {
        const { default: ValidateChapterContentJob } =
          await import('#jobs/validate_chapter_content_job')
        return (
          ((await dispatch(ValidateChapterContentJob, commonPayload, { jobId })) as
            | string
            | undefined) || jobId
        )
      }
      case BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED: {
        const { default: BuildContentAndVocabSeedJob } =
          await import('#jobs/build_content_and_vocab_seed_job')
        return (
          ((await dispatch(BuildContentAndVocabSeedJob, commonPayload, { jobId })) as
            | string
            | undefined) || jobId
        )
      }
      case BOOK_IMPORT_STEP.ENRICH_VOCABULARY: {
        const { default: EnrichVocabularyJob } = await import('#jobs/enrich_vocabulary_job')
        return (
          ((await dispatch(EnrichVocabularyJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      case BOOK_IMPORT_STEP.GENERATE_TAGS: {
        const { default: GenerateTagsJob } = await import('#jobs/generate_tags_job')
        return (
          ((await dispatch(GenerateTagsJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      case BOOK_IMPORT_STEP.GENERATE_TTS: {
        const { default: GenerateTtsJob } = await import('#jobs/generate_tts_job')
        return (
          ((await dispatch(GenerateTtsJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      case BOOK_IMPORT_STEP.FINALIZE_IMPORT: {
        const { default: FinalizeImportJob } = await import('#jobs/finalize_import_job')
        return (
          ((await dispatch(FinalizeImportJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      default:
        throw new Error(`Unsupported dispatch step: ${String(stepKey)}`)
    }
  }

  async validateSourceFile(
    book: Book
  ): Promise<{ storagePath: string; absolutePath: string; ext: string }> {
    if (!book.rawFilePath || !book.rawFileExt) {
      throw new Error('Raw source file metadata missing')
    }

    const exists = await drive.use().exists(book.rawFilePath)
    if (!exists) {
      throw new Error(`Raw source file not found: ${book.rawFilePath}`)
    }

    const absolutePath = app.makePath('storage', book.rawFilePath)

    return { storagePath: book.rawFilePath, absolutePath, ext: book.rawFileExt.toLowerCase() }
  }

  async parseSourceFile(params: {
    storagePath: string
    absolutePath: string
    ext: string
  }): Promise<ParsedSourceResult> {
    const parsed = await this.parserService.parseFileFromStorage(
      params.storagePath,
      params.absolutePath,
      params.ext
    )
    return {
      title: parsed.title,
      author: parsed.author,
      description: parsed.description,
      chapters: parsed.chapters.map((chapter, index) => ({
        title: chapter.title,
        content: chapter.content,
        chapterIndex: index,
      })),
      wordCount: parsed.wordCount,
    }
  }

  async semanticExtractMetadata(params: {
    book: Book
    parsed: ParsedSourceResult
  }): Promise<{ title: string; author: string | null; description: string | null }> {
    const metadata = await this.semanticCleaner.extractMetadata({
      fileName: params.book.rawFileName || params.parsed.title,
      sourceType: params.book.source,
      chapterTitles: params.parsed.chapters.slice(0, 30).map((item) => item.title),
      sampleText: params.parsed.chapters
        .slice(0, 3)
        .map((item) => item.content)
        .join('\n\n'),
    })

    return metadata
  }

  async semanticCleanChapters(parsed: ParsedSourceResult) {
    const cleaned = await this.semanticCleaner.cleanChapters(
      parsed.chapters.map((chapter) => ({
        title: chapter.title,
        content: chapter.content,
      }))
    )

    if (cleaned.length === 0) {
      throw new Error('No readable chapters after semantic cleaning')
    }

    return cleaned
  }

  async writeChapterArtifact(params: {
    runId: number
    bookId: number
    stepKey: string
    chapters: ChapterArtifactItem[]
  }): Promise<string> {
    const artifactsDir = app.makePath('tmp', 'book-import-artifacts')
    await mkdir(artifactsDir, { recursive: true })

    const fileName = `run-${params.runId}-book-${params.bookId}-${params.stepKey}-${Date.now()}.json`
    const artifactPath = path.join(artifactsDir, fileName)

    await writeFile(
      artifactPath,
      JSON.stringify(
        {
          runId: params.runId,
          bookId: params.bookId,
          stepKey: params.stepKey,
          chapters: params.chapters,
        },
        null,
        2
      ),
      'utf8'
    )

    return artifactPath
  }

  async readChapterArtifact(artifactPath: string): Promise<ChapterArtifactItem[]> {
    const raw = await readFile(artifactPath, 'utf8')
    const parsed = JSON.parse(raw) as { chapters?: unknown }

    if (!Array.isArray(parsed.chapters)) {
      throw new Error(`Invalid chapter artifact payload: ${artifactPath}`)
    }

    return parsed.chapters.map((chapter, index) => {
      const item = chapter as Record<string, unknown>
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const content = typeof item.content === 'string' ? item.content.trim() : ''
      const chapterIndex =
        typeof item.chapterIndex === 'number'
          ? item.chapterIndex
          : Number.parseInt(String(index), 10)

      if (!title || !content) {
        throw new Error(`Invalid chapter artifact item at index ${index}: ${artifactPath}`)
      }

      return {
        title,
        content,
        chapterIndex,
      }
    })
  }

  async getSuccessfulStepOutputRef(
    runId: number,
    stepKey: string
  ): Promise<Record<string, unknown>> {
    const stepLog = await BookProcessingStepLog.query()
      .where('runLogId', runId)
      .where('stepKey', stepKey)
      .where('status', 'success')
      .orderBy('id', 'desc')
      .first()

    if (!stepLog?.outputRef) {
      throw new Error(`Missing successful output ref for step: ${stepKey}`)
    }

    return stepLog.outputRef
  }

  requireOutputRefString(outputRef: Record<string, unknown>, key: string): string {
    const value = outputRef[key]
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Missing output reference field: ${key}`)
    }
    return value
  }

  async persistChaptersAndContentHash(params: {
    book: Book
    metadata: { title: string; author: string | null; description: string | null }
    cleanedChapters: Array<{ title: string; content: string; chapterIndex: number }>
  }): Promise<{ contentHash: string; wordCount: number; readingTime: number }> {
    const { book, metadata, cleanedChapters } = params

    // Validate chapters using Content Guard Service before persistence
    const validChapters: Array<{ title: string; content: string; chapterIndex: number }> = []
    const validationErrors: Array<{ chapterIndex: number; errors: string[] }> = []

    for (const chapter of cleanedChapters) {
      const guardInput = `# ${chapter.title}\n\n${chapter.content}`
      const result = this.guardService.validate(guardInput)
      if (result.valid) {
        validChapters.push(chapter)
      } else {
        validationErrors.push({
          chapterIndex: chapter.chapterIndex,
          errors: result.errors,
        })
      }
    }

    // Log validation errors for debugging
    if (validationErrors.length > 0) {
      logger.warn(
        { bookId: book.id, rejectedChapterCount: validationErrors.length, validationErrors },
        '[ContentGuard] Some chapters were rejected during import'
      )
    }

    // Ensure we still have valid chapters after filtering
    if (validChapters.length === 0) {
      throw new Error('No valid chapters remaining after content validation')
    }

    // Re-index chapters after filtering
    const finalChapters = validChapters.map((chapter, index) => ({
      ...chapter,
      chapterIndex: index,
    }))

    // Pre-compute metrics outside transaction to minimize lock hold time
    const wordCount = finalChapters.reduce(
      (sum, chapter) => sum + chapter.content.split(/\s+/).filter(Boolean).length,
      0
    )
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))
    const contentHash = this.hashService.hashNormalizedBook(finalChapters)

    await db.transaction(async (trx) => {
      await BookChapter.query({ client: trx }).where('bookId', book.id).delete()
      await BookChapter.createMany(
        finalChapters.map((chapter, index) => ({
          bookId: book.id,
          chapterIndex: index,
          title: chapter.title,
          content: chapter.content,
        })),
        { client: trx }
      )

      await book
        .useTransaction(trx)
        .merge({
          title: metadata.title || book.title,
          author: metadata.author,
          description: metadata.description,
          contentHash,
          wordCount,
          readingTime,
        })
        .save()
    })

    return { contentHash, wordCount, readingTime }
  }

  async extractVocabulary(book: Book) {
    const chapters = await BookChapter.query()
      .where('bookId', book.id)
      .orderBy('chapterIndex', 'asc')
    const content = chapters.map((item) => item.content).join('\n\n')
    const vocabulary = this.analyzerService.extractVocabulary(content)
    await this.analyzerService.saveVocabulary(
      book.id,
      vocabulary.map((item) => ({
        ...item,
        meaning: '',
        sentence: '',
      }))
    )
    return vocabulary
  }

  async assignBookLevel(book: Book): Promise<{
    levelId: number
    levelCode: string
    uniqueLemmaCount: number
    classifiedBy: 'ai' | 'rule'
    reason: string
  }> {
    const result = await BookVocabulary.query()
      .where('bookId', book.id)
      .countDistinct('lemma as total')
      .firstOrFail()
    const uniqueLemmaCount = Number(result.$extras.total || 0)
    const chapters = await BookChapter.query()
      .where('bookId', book.id)
      .orderBy('chapterIndex', 'asc')
      .limit(3)
    const sampleText = chapters
      .map((item) => item.content)
      .join('\n\n')
      .slice(0, 5000)

    const activeLevels = await this.bookLevelService.listActiveLevels()
    const fallbackLevel = await this.bookLevelService.getFallbackLevelByWords(uniqueLemmaCount)
    let selectedLevel = fallbackLevel
    let classifiedBy: 'ai' | 'rule' = 'rule'
    let reason = 'Fallback by unique lemma count'

    try {
      const aiResult = await this.semanticCleaner.classifyBookLevel({
        wordCount: book.wordCount,
        uniqueLemmaCount,
        sampleText,
        candidates: activeLevels.map((level) => ({
          id: level.id,
          code: level.code,
          description: level.description,
          minWords: level.minWords,
          maxWords: level.maxWords,
          sortOrder: level.sortOrder,
        })),
      })
      const match = activeLevels.find((level) => level.id === aiResult.levelId)
      const withinOneLevel =
        match &&
        Math.abs((match.sortOrder || 0) - (fallbackLevel.sortOrder || 0)) <= 1
      if (match && withinOneLevel) {
        selectedLevel = match
        classifiedBy = 'ai'
        reason = aiResult.reason
      }
    } catch {
      // fallback selected above
    }

    await book
      .merge({
        levelId: selectedLevel.id,
        levelClassifiedBy: classifiedBy,
        levelClassifiedAt: DateTime.now(),
      })
      .save()

    return {
      levelId: selectedLevel.id,
      levelCode: selectedLevel.code,
      uniqueLemmaCount,
      classifiedBy,
      reason,
    }
  }

  async dispatchParallelJobs(bookId: number) {
    await Promise.all([
      GenerateBookAudioJob.dispatch({ bookId }),
      GenerateBookVocabularyJob.dispatch({ bookId }),
    ])
  }

  async reconcileParallelProgress(book: Book) {
    const totalChaptersResult = await BookChapter.query()
      .where('bookId', book.id)
      .count('* as total')
      .firstOrFail()
    const completedAudioResult = await BookChapterAudio.query()
      .where('bookId', book.id)
      .where('status', 'completed')
      .count('* as total')
      .firstOrFail()

    const totalChapters = Number(totalChaptersResult.$extras.total || 0)
    const completedChapters = Number(completedAudioResult.$extras.total || 0)
    const audioProgress =
      totalChapters === 0 ? 0 : Math.round((completedChapters / totalChapters) * 100)

    await book.refresh()
    const vocabularyProgress =
      book.vocabularyStatus === 'completed' ? 100 : book.vocabularyStatus === 'processing' ? 50 : 0

    const parallelProgress = Math.round(audioProgress * 0.5 + vocabularyProgress * 0.5)
    return {
      audioProgress,
      vocabularyProgress,
      parallelProgress,
      audioDone: book.audioStatus === 'completed',
      vocabularyDone: book.vocabularyStatus === 'completed',
    }
  }

  async finalizePublish(book: Book): Promise<boolean> {
    await book.refresh()
    if (book.audioStatus !== 'completed' || book.vocabularyStatus !== 'completed') {
      return false
    }
    return true
  }

  buildStepPayload(inputSummary: Record<string, unknown>, resultSummary?: Record<string, unknown>) {
    const digest = createHash('sha256').update(JSON.stringify(inputSummary)).digest('hex')
    return {
      input_hash: digest,
      output_ref: {
        inputSummary,
        resultSummary: resultSummary || null,
        errorMeta: null,
      },
    }
  }

  buildStepError(inputSummary: Record<string, unknown>, error: unknown) {
    const digest = createHash('sha256').update(JSON.stringify(inputSummary)).digest('hex')
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      input_hash: digest,
      output_ref: {
        inputSummary,
        resultSummary: null,
        errorMeta: { message },
      },
    }
  }
}
