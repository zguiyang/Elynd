import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { DictionaryService } from '#services/shared/dictionary_service'
import { dictionaryLookupValidator } from '#validators/dictionary_validator'

@inject()
export default class DictionaryController {
  constructor(private dictionaryService: DictionaryService) {}

  async lookup({ params, request }: HttpContext) {
    const data = await request.validateUsing(dictionaryLookupValidator, {
      data: { word: params.word },
    })
    const word = data.word

    if (!word) {
      throw new Exception('Word is required', { status: 400 })
    }

    const result = await this.dictionaryService.lookup(word)

    if (!result) {
      throw new Exception('Word not found', { status: 404 })
    }

    return result
  }
}
