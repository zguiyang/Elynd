import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import { ChapterTranslationService } from '#services/chapter_translation_service'
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
