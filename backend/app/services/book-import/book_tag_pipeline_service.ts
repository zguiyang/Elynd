import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookVocabulary from '#models/book_vocabulary'
import Tag from '#models/tag'
import { AI, BOOK_IMPORT_STEP } from '#constants'
import { AiService } from '#services/ai/ai_service'
import type { AiChatParams, AiClientConfig } from '#types/ai'
import PromptService from '#services/ai/prompt_service'
import { ConfigService } from '#services/ai/config_service'
import { TagService } from '#services/book/tag_service'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import { ImportStateService } from '#services/book-import/import_state_service'
import GenerateTtsJob from '#jobs/generate_tts_job'
import type { SerialImportPayload } from '#types/book_import_pipeline'

interface AiTagSelectionResponse {
  existingTags?: unknown
  newTags?: unknown
  tags?: unknown
}

interface GenerateTagsResult {
  selectedTagNames: string[]
  createdTagNames: string[]
  attachedTagIds: number[]
}

@inject()
export class BookTagPipelineService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private configService: ConfigService,
    private tagService: TagService,
    private importStateService: ImportStateService
  ) {}

  async run(payload: SerialImportPayload) {
    const { bookId, runId, userId } = payload
    const book = await Book.findOrFail(bookId)
    await this.importStateService.assertImportNotCancelled(runId, bookId)
    const progress = BookImportOrchestratorService.getBaseProgressByStep(
      BOOK_IMPORT_STEP.GENERATE_TAGS
    )
    const step = await this.importStateService.startStep(
      runId,
      bookId,
      BOOK_IMPORT_STEP.GENERATE_TAGS,
      progress
    )

    try {
      await this.importStateService.assertImportNotCancelled(runId, bookId)
      const result = await this.generateAndAttachTags(book)
      await this.importStateService.assertImportNotCancelled(runId, bookId)

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.GENERATE_TAGS,
        progress,
        {
          selectedTagNames: result.selectedTagNames,
          createdTagNames: result.createdTagNames,
          attachedTagCount: result.attachedTagIds.length,
        }
      )

      await GenerateTtsJob.dispatch(
        { bookId, runId, userId },
        {
          jobId: BookImportOrchestratorService.buildPipelineJobId({
            runId,
            bookId,
            stepKey: BOOK_IMPORT_STEP.GENERATE_TTS,
          }),
        }
      )
    } catch (error) {
      if (ImportStateService.isImportCancelledError(error)) {
        return
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.importStateService.failStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.GENERATE_TAGS,
        message
      )
      throw error
    }
  }

  private async resolveAiConfig(): Promise<AiClientConfig> {
    const config = await this.configService.getAiConfig()
    return {
      ...config,
      timeout: AI.DEFAULT_TIMEOUT,
      maxRetries: AI.DEFAULT_MAX_RETRIES,
    }
  }

  private async generateAndAttachTags(book: Book): Promise<GenerateTagsResult> {
    const existingTags = await Tag.query().orderBy('name', 'asc')
    const chapters = await BookChapter.query()
      .where('bookId', book.id)
      .orderBy('chapterIndex', 'asc')
      .limit(3)
    const vocabularies = await BookVocabulary.query()
      .where('bookId', book.id)
      .orderBy('frequency', 'desc')
      .limit(40)

    const aiConfig = await this.resolveAiConfig()
    const systemPrompt = this.promptService.render('system', {})
    const userPrompt = this.promptService.render('book/tag-selection', {
      title: book.title,
      author: book.author,
      description: book.description,
      chapterTitles: chapters.map((chapter) => chapter.title),
      sampleText: chapters
        .map((chapter) => chapter.content)
        .join('\n\n')
        .slice(0, 6000),
      vocabulary: vocabularies.map((item) => item.word),
      existingTags: existingTags.map((item) => item.name),
    })
    const params: AiChatParams = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 1200,
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
    }

    let aiResult: AiTagSelectionResponse = {}
    try {
      aiResult = await this.aiService.chatJson<AiTagSelectionResponse>(aiConfig, params)
    } catch (error) {
      logger.warn(
        { err: error, bookId: book.id },
        'AI tag selection failed, fallback to deterministic tag selection'
      )
    }

    const existingBySlug = new Map(
      existingTags.map((tag) => [this.tagService.generateSlug(tag.name), tag])
    )
    const selectedTags: Tag[] = []
    const selectedIds = new Set<number>()
    const createdTagNames: string[] = []

    const existingCandidates = this.normalizeTagNames(aiResult.existingTags)
    const newCandidates = this.normalizeTagNames(aiResult.newTags)
    const genericCandidates = this.normalizeTagNames(aiResult.tags)

    this.pickFromExisting(existingCandidates, existingBySlug, selectedTags, selectedIds)
    this.pickFromExisting(genericCandidates, existingBySlug, selectedTags, selectedIds)

    for (const name of newCandidates) {
      if (selectedTags.length >= 2) {
        break
      }
      const slug = this.tagService.generateSlug(name)
      if (!slug) {
        continue
      }
      const existedBefore = existingBySlug.has(slug)
      const tag = await this.tagService.findOrCreateByName(name)
      existingBySlug.set(slug, tag)

      if (selectedIds.has(tag.id)) {
        continue
      }
      selectedIds.add(tag.id)
      selectedTags.push(tag)
      if (!existedBefore) {
        createdTagNames.push(tag.name)
      }
    }

    if (selectedTags.length === 0) {
      this.pickFromExisting(
        this.pickFallbackTagNames(book, existingTags),
        existingBySlug,
        selectedTags,
        selectedIds
      )
    }

    if (selectedTags.length === 0) {
      const fallbackTag = await this.tagService.findOrCreateByName('General Reading')
      selectedTags.push(fallbackTag)
      if (!existingBySlug.has(this.tagService.generateSlug(fallbackTag.name))) {
        createdTagNames.push(fallbackTag.name)
      }
    }

    const attachedTagIds = await this.attachTagsToBook(book, selectedTags)

    return {
      selectedTagNames: selectedTags.map((tag) => tag.name),
      createdTagNames,
      attachedTagIds,
    }
  }

  private pickFromExisting(
    candidateNames: string[],
    existingBySlug: Map<string, Tag>,
    selectedTags: Tag[],
    selectedIds: Set<number>
  ) {
    for (const name of candidateNames) {
      if (selectedTags.length >= 2) {
        break
      }
      const slug = this.tagService.generateSlug(name)
      if (!slug) {
        continue
      }
      const matched = existingBySlug.get(slug)
      if (!matched || selectedIds.has(matched.id)) {
        continue
      }
      selectedTags.push(matched)
      selectedIds.add(matched.id)
    }
  }

  private normalizeTagNames(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
      return []
    }

    const names: string[] = []
    const seen = new Set<string>()

    for (const item of raw) {
      const value =
        typeof item === 'string'
          ? item
          : typeof item === 'object' &&
              item !== null &&
              'name' in item &&
              typeof (item as { name?: unknown }).name === 'string'
            ? (item as { name: string }).name
            : ''

      const normalized = value.replace(/\s+/g, ' ').trim().slice(0, 50)
      if (!normalized) {
        continue
      }

      const key = this.tagService.generateSlug(normalized)
      if (!key || seen.has(key)) {
        continue
      }

      seen.add(key)
      names.push(normalized)
    }

    return names
  }

  private pickFallbackTagNames(book: Book, existingTags: Tag[]): string[] {
    if (existingTags.length === 0) {
      return []
    }

    const corpus = `${book.title} ${book.author || ''} ${book.description || ''}`.toLowerCase()
    const scored = existingTags
      .map((tag) => {
        const token = tag.name.toLowerCase()
        const score = corpus.includes(token) ? token.length : 0
        return { tag, score }
      })
      .sort((a, b) => b.score - a.score || a.tag.name.localeCompare(b.tag.name))

    const picked = scored.slice(0, 2).map((item) => item.tag.name)
    if (picked.length > 0 && scored[0].score > 0) {
      return picked
    }

    return [existingTags[0].name]
  }

  private async attachTagsToBook(book: Book, tags: Tag[]): Promise<number[]> {
    const currentTags = await book.related('tags').query().select('id')
    const currentTagIds = new Set(currentTags.map((item) => item.id))
    const missingTagIds = tags.map((tag) => tag.id).filter((id) => !currentTagIds.has(id))

    if (missingTagIds.length > 0) {
      await book.related('tags').attach(missingTagIds)
    }

    return tags.map((tag) => tag.id)
  }
}
