import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { DictionaryService } from '#services/dictionary_service'

@inject()
export default class DictionaryController {
  constructor(private dictionaryService: DictionaryService) {}

  async lookup({ params }: HttpContext) {
    const word = params.word?.trim()

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
