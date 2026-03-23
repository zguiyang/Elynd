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

  async events(ctx: HttpContext) {
    const translationId = Number(ctx.params.id)
    if (!Number.isInteger(translationId) || translationId <= 0) {
      throw new Exception('Invalid translation id', { status: 422 })
    }

    const sse = createSseWriter(ctx)
    sse.comment('connected')

    let timer: ReturnType<typeof setInterval> | null = null
    let lastStatus: string | null = null
    let isReading = false

    const cleanup = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    sse.onClose(() => {
      cleanup()
    })

    const pushStatus = async () => {
      if (sse.isClosed() || isReading) {
        return
      }

      isReading = true
      try {
        const status = await this.chapterTranslationService.getStatus(translationId)

        if (status.status !== lastStatus) {
          sse.send({
            type: 'status',
            translationId: status.translationId,
            status: status.status,
            errorMessage: status.errorMessage,
          })
          lastStatus = status.status
        }

        if (status.status === 'completed' || status.status === 'failed') {
          cleanup()
          sse.close()
        }
      } catch {
        sse.send({ type: 'error', message: 'Failed to query translation status' })
        cleanup()
        sse.close()
      } finally {
        isReading = false
      }
    }

    await pushStatus()
    if (sse.isClosed()) {
      return
    }

    timer = setInterval(() => {
      void pushStatus()
    }, 1500)
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
