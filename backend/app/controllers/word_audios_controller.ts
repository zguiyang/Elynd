import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { WordAudioService } from '#services/dictionary/word_audio_service'
import { wordAudioValidator } from '#validators/word_audio_validator'

@inject()
export default class WordAudiosController {
  constructor(private wordAudioService: WordAudioService) {}

  async show({ params, request }: HttpContext) {
    const data = await request.validateUsing(wordAudioValidator, {
      data: {
        word: params.word,
      },
    })

    const audio = await this.wordAudioService.getAudio(data.word)

    return { audio }
  }
}
