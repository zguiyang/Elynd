import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import { WORD_AUDIO } from '#constants'
import { TtsService } from '#services/shared/tts_service'

const WORD_AUDIO_MIME_TYPE = 'audio/mp3'

@inject()
export class WordAudioService {
  constructor(private ttsService: TtsService) {}

  async getAudio(word: string): Promise<string> {
    const normalizedWord = this.normalizeWord(word)

    if (!normalizedWord) {
      throw new Exception('Word is required', { status: 422 })
    }

    const cacheKey = this.getCacheKey(normalizedWord)
    const cachedAudio = await this.getCachedAudio(cacheKey)

    if (cachedAudio) {
      return cachedAudio
    }

    const audioBuffer = await this.ttsService.synthesizeTextToBuffer(
      normalizedWord,
      this.ttsService.getCurrentVoiceName()
    )
    const audio = this.toAudioDataUrl(audioBuffer)

    await this.cacheAudio(cacheKey, audio)

    return audio
  }

  normalizeWord(word: string): string {
    return word
      .trim()
      .toLowerCase()
      .replace(/^[^a-z]+|[^a-z]+$/gi, '')
  }

  private getCacheKey(word: string): string {
    return `${WORD_AUDIO.CACHE_PREFIX}${word}`
  }

  private async getCachedAudio(cacheKey: string): Promise<string | null> {
    try {
      const cached = await redis.get(cacheKey)
      if (!cached) {
        return null
      }

      if (cached.startsWith('data:audio/')) {
        return cached
      }

      return this.toAudioDataUrl(Buffer.from(cached, 'base64'))
    } catch (error) {
      logger.warn({ err: error, cacheKey }, 'Failed to read word audio cache')
      return null
    }
  }

  private async cacheAudio(cacheKey: string, audio: string): Promise<void> {
    try {
      await redis.setex(cacheKey, WORD_AUDIO.CACHE_TTL_SECONDS, audio)
    } catch (error) {
      logger.warn({ err: error, cacheKey }, 'Failed to cache word audio')
    }
  }

  private toAudioDataUrl(audioBuffer: Buffer): string {
    return `data:${WORD_AUDIO_MIME_TYPE};base64,${audioBuffer.toString('base64')}`
  }
}
