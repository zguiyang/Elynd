import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { DictionaryService } from '#services/dictionary/dictionary_service'
import { dictionaryLookupValidator } from '#validators/dictionary_validator'

@inject()
export default class DictionaryController {
  constructor(private dictionaryService: DictionaryService) {}

  async lookup({ auth, params, request }: HttpContext) {
    const rawBookId = request.input('bookId')
    const rawChapterIndex = request.input('chapterIndex')

    const data = await request.validateUsing(dictionaryLookupValidator, {
      data: {
        word: params.word,
        bookId: rawBookId === undefined ? undefined : Number(rawBookId),
        chapterIndex: rawChapterIndex === undefined ? undefined : Number(rawChapterIndex),
      },
    })
    const word = data.word

    if (!word) {
      throw new Exception('Word is required', { status: 400 })
    }

    const result = await this.dictionaryService.lookup({
      word,
      userId: auth.getUserOrFail().id,
      bookId: data.bookId,
      chapterIndex: data.chapterIndex,
    })

    if (!result) {
      throw new Exception('查询失败，请稍后重试', { status: 503 })
    }

    return result
  }
}
