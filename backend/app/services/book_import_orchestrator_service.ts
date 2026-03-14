import { inject } from '@adonisjs/core'
import { createHash } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import BookVocabulary from '#models/book_vocabulary'
import { BookParserService } from '#services/book_parser_service'
import { BookSemanticCleanService } from '#services/book_semantic_clean_service'
import { VocabularyAnalyzerService } from '#services/vocabulary_analyzer_service'
import { BookHashService } from '#services/book_hash_service'
import PromptService from '#services/prompt_service'
import { AiService } from '#services/ai_service'
import { BookChapterCleanerService } from '#services/book_chapter_cleaner_service'
import { ConfigService } from '#services/config_service'
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

@inject()
export class BookImportOrchestratorService {
  private hashService = new BookHashService()

  constructor(
    private parserService: BookParserService,
    private aiService: AiService,
    private analyzerService: VocabularyAnalyzerService,
    private configService: ConfigService
  ) {}

  static getBaseProgressByStep(step: string): number {
    const weights: Array<{ key: string; weight: number }> = [
      { key: BOOK_IMPORT_STEP.PREPARE_IMPORT, weight: BOOK_IMPORT_PROGRESS.PREPARE_IMPORT },
      { key: BOOK_IMPORT_STEP.SEMANTIC_CLEAN, weight: BOOK_IMPORT_PROGRESS.SEMANTIC_CLEAN },
      {
        key: BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
        weight: BOOK_IMPORT_PROGRESS.BUILD_CONTENT_AND_VOCAB_SEED,
      },
      { key: BOOK_IMPORT_STEP.ENRICH_VOCABULARY, weight: BOOK_IMPORT_PROGRESS.ENRICH_VOCABULARY },
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
    const cleaner = this.buildSemanticCleaner()
    const metadata = await cleaner.extractMetadata({
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
    const cleaner = this.buildSemanticCleaner()
    const cleaned = await cleaner.cleanChapters(
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

  async persistChaptersAndContentHash(params: {
    book: Book
    metadata: { title: string; author: string | null; description: string | null }
    cleanedChapters: Array<{ title: string; content: string; chapterIndex: number }>
  }): Promise<{ contentHash: string; wordCount: number; readingTime: number }> {
    const { book, metadata, cleanedChapters } = params

    await BookChapter.query().where('bookId', book.id).delete()
    await BookChapter.createMany(
      cleanedChapters.map((chapter, index) => ({
        bookId: book.id,
        chapterIndex: index,
        title: chapter.title,
        content: chapter.content,
      }))
    )

    const wordCount = cleanedChapters.reduce(
      (sum, chapter) => sum + chapter.content.split(/\s+/).filter(Boolean).length,
      0
    )
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))
    const contentHash = this.hashService.hashNormalizedBook(cleanedChapters)

    await book
      .merge({
        title: metadata.title || book.title,
        author: metadata.author,
        description: metadata.description,
        contentHash,
        wordCount,
        readingTime,
      })
      .save()

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

  async assignDifficultyLevel(
    book: Book
  ): Promise<{ difficultyLevel: 'L1' | 'L2' | 'L3'; uniqueLemmaCount: number }> {
    const result = await BookVocabulary.query()
      .where('bookId', book.id)
      .countDistinct('lemma as total')
      .firstOrFail()
    const uniqueLemmaCount = Number(result.$extras.total || 0)

    const difficultyLevel: 'L1' | 'L2' | 'L3' =
      uniqueLemmaCount <= 1000 ? 'L1' : uniqueLemmaCount <= 2000 ? 'L2' : 'L3'

    await book.merge({ difficultyLevel }).save()

    return { difficultyLevel, uniqueLemmaCount }
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

    await book
      .merge({
        status: 'ready',
        isPublished: true,
        processingStep: BOOK_IMPORT_STEP.COMPLETED,
        processingProgress: 100,
        processingError: null,
      })
      .save()
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

  private buildSemanticCleaner() {
    return new BookSemanticCleanService(
      this.aiService,
      new PromptService(),
      new BookChapterCleanerService(),
      this.configService
    )
  }
}
