import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import { ChapterTranslationService } from '#services/book/chapter_translation_service'
import { createSseWriter } from '#utils/sse'
import {
  queryChapterTranslationValidator,
  triggerChapterTranslationValidator,
} from '#validators/chapter_translation_validator'

@inject()
export default class ChapterTranslationsController {
  constructor(private chapterTranslationService: ChapterTranslationService) {}

  async trigger({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const chapterId = Number(params.chapterId)
    if (!Number.isInteger(chapterId) || chapterId <= 0) {
      throw new Exception('Invalid chapter id', { status: 422 })
    }

    const data = await request.validateUsing(triggerChapterTranslationValidator)
    const result = await this.chapterTranslationService.requestTranslation({
      chapterId,
      userId: user.id,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
    })

    if (result.status === 'queued') {
      return response.status(202).send(result)
    }

    return result
  }

  async status({ params }: HttpContext) {
    const translationId = Number(params.id)
    if (!Number.isInteger(translationId) || translationId <= 0) {
      throw new Exception('Invalid translation id', { status: 422 })
    }

    return this.chapterTranslationService.getStatus(translationId)
  }

  async progress({ params }: HttpContext) {
    const translationId = Number(params.id)
    if (!Number.isInteger(translationId) || translationId <= 0) {
      throw new Exception('Invalid translation id', { status: 422 })
    }

    const progress = await this.chapterTranslationService.getProgress(translationId)
    if (!progress) {
      throw new Exception('Translation not found', { status: 404 })
    }

    return progress
  }

  async events(ctx: HttpContext) {
    const translationId = Number(ctx.params.id)
    if (!Number.isInteger(translationId) || translationId <= 0) {
      throw new Exception('Invalid translation id', { status: 422 })
    }

    const sse = createSseWriter(ctx)
    sse.comment('connected')

    let timer: ReturnType<typeof setInterval> | null = null
    let lastProgress: string | null = null

    const cleanup = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    sse.onClose(() => {
      cleanup()
    })

    ctx.request.request.on('close', () => {
      cleanup()
    })

    // Initial status
    try {
      const status = await this.chapterTranslationService.getStatus(translationId)
      sse.send({
        type: 'status',
        translationId,
        status: status.status,
        errorMessage: status.errorMessage,
      })

      if (status.status === 'completed' || status.status === 'failed') {
        sse.close()
        return
      }
    } catch {
      sse.send({ type: 'error', message: 'Failed to get initial status' })
      sse.close()
      return
    }

    // Poll progress every 500ms
    timer = setInterval(async () => {
      if (sse.isClosed()) {
        cleanup()
        return
      }

      try {
        const progress = await this.chapterTranslationService.getProgress(translationId)

        if (!progress) {
          return
        }

        const currentProgress = JSON.stringify(progress)

        // Only send if progress has changed
        if (currentProgress !== lastProgress) {
          lastProgress = currentProgress

          // Send paragraph updates
          progress.paragraphs.forEach((p) => {
            if (p.status === 'completed' && p.sentences) {
              sse.send({
                type: 'paragraph',
                paragraphIndex: p.paragraphIndex,
                status: 'completed',
                sentences: p.sentences,
              })
            } else if (p.status === 'failed') {
              sse.send({
                type: 'paragraph',
                paragraphIndex: p.paragraphIndex,
                status: 'failed',
                error: p.error,
              })
            }
          })

          // Send title if translated
          if (progress.title.translated) {
            sse.send({
              type: 'title',
              title: progress.title,
            })
          }

          // Send overall status
          sse.send({
            type: 'status',
            translationId,
            status: progress.status,
            currentParagraph: progress.completedParagraphs,
            totalParagraphs: progress.totalParagraphs,
          })

          sse.send({
            type: 'progress',
            completedParagraphs: progress.completedParagraphs,
            totalParagraphs: progress.totalParagraphs,
          })

          if (progress.status === 'completed' || progress.status === 'failed') {
            cleanup()
            sse.close()
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 500)
  }

  async retryParagraph({ params, response }: HttpContext) {
    const translationId = Number(params.id)
    if (!Number.isInteger(translationId) || translationId <= 0) {
      throw new Exception('Invalid translation id', { status: 422 })
    }

    const paragraphIndex = Number(params.index)
    if (!Number.isInteger(paragraphIndex) || paragraphIndex < 0) {
      throw new Exception('Invalid paragraph index', { status: 422 })
    }

    const result = await this.chapterTranslationService.retryParagraph(translationId, paragraphIndex)
    return response.status(202).send(result)
  }

  async show({ params, request }: HttpContext) {
    const chapterId = Number(params.chapterId)
    if (!Number.isInteger(chapterId) || chapterId <= 0) {
      throw new Exception('Invalid chapter id', { status: 422 })
    }

    const data = await request.validateUsing(queryChapterTranslationValidator)
    const result = await this.chapterTranslationService.getChapterResult({
      chapterId,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
    })

    return result
  }
}
