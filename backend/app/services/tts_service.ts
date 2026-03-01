import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import drive from '@adonisjs/drive/services/main'
import type { PiperTtsResponse, TtsResult } from '#types/tts'

const TTS_TIMEOUT = 60000

@inject()
export class TtsService {
  private readonly apiUrl: string
  private readonly apiKey: string | undefined

  constructor() {
    this.apiUrl = env.get('TTS_API_URL')!
    this.apiKey = env.get('TTS_API_KEY')
  }

  async generateAudio(text: string, articleId: number): Promise<TtsResult> {
    logger.info(`Generating audio for article ${articleId}`)

    const response = await this.callPiperApi(text)
    await this.downloadAndSave(response.data!.url, articleId)

    const audioUrl = `articles/${articleId}.mp3`

    return {
      audioUrl,
      timing: null,
    }
  }

  async callPiperApi(text: string): Promise<PiperTtsResponse> {
    const url = `${this.apiUrl}/synthesize`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          response_format: 'mp3',
          length_scale: 1.0,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`TTS API error: ${response.status} ${errorText}`)
      }

      const data = (await response.json()) as PiperTtsResponse

      if (!data.success || !data.data) {
        throw new Error(data.error || 'TTS API returned unsuccessful response')
      }

      return data
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`TTS API timeout after ${TTS_TIMEOUT / 1000} seconds`)
      }

      throw error
    }
  }

  async downloadAndSave(url: string, articleId: number): Promise<string> {
    const key = `articles/${articleId}.mp3`

    logger.info(`Downloading audio from ${url} to ${key}`)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await drive.use().put(key, buffer)

    logger.info(`Audio saved to ${key}`)

    return key
  }
}
