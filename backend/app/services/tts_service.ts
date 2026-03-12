import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import drive from '@adonisjs/drive/services/main'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import { speechSdkTicksToMs } from '#utils/speech_sdk_time'
import type {
  TtsResult,
  AudioTiming,
  WordTiming,
  ChapterTiming,
  ChapterInput,
  ChapterAudioResult,
  TtsErrorDetails,
} from '#types/tts'

@inject()
export class TtsService {
  private speechConfig: sdk.SpeechConfig
  private readonly audioUrl: string = 'book/voices'

  constructor() {
    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      env.get('TTS_API_KEY'),
      env.get('TTS_REGION')
    )
    this.speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
    this.speechConfig.speechSynthesisVoiceName = 'en-US-Ava:DragonHDLatestNeural'
    this.speechConfig.setProperty(
      sdk.PropertyId.SpeechServiceResponse_RequestSentenceBoundary,
      'true'
    )
  }

  /**
   * Generate audio for a single chapter.
   * Returns a deterministic audio file path and timing metadata.
   */
  async generateChapterAudio(
    chapter: ChapterInput,
    bookId: number,
    _options?: { voiceName?: string }
  ): Promise<ChapterAudioResult> {
    const startTime = Date.now()
    const textLength = chapter.content.length
    const voiceName = this.speechConfig.speechSynthesisVoiceName || 'default'

    logger.info(
      {
        bookId,
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        textLength,
        provider: 'azure_tts',
        voiceName,
      },
      'Generating chapter audio'
    )

    const text = `${chapter.title}\n\n${chapter.content}`
    const result = await this.synthesizeChapter(text, chapter.chapterIndex)

    const elapsedMs = Date.now() - startTime

    // Generate deterministic path: book/voices/{bookId}/chapter-{chapterIndex}.mp3
    const audioPath = `${this.audioUrl}/${bookId}/chapter-${chapter.chapterIndex}.mp3`
    await drive.use().put(audioPath, result.audioBuffer)

    logger.info(
      {
        bookId,
        chapterIndex: chapter.chapterIndex,
        durationMs: result.duration,
        elapsedMs,
        audioPath,
      },
      'Chapter audio generated successfully'
    )

    return {
      chapterIndex: chapter.chapterIndex,
      audioPath,
      duration: result.duration,
      timing: {
        words: result.wordTimings,
      },
    }
  }

  /**
   * Generate merged audio for all chapters (legacy method for backward compatibility).
   */
  async generateAudio(chapters: ChapterInput[], bookId: number): Promise<TtsResult> {
    logger.info({ bookId, chapterCount: chapters.length }, 'Starting audio generation')

    const allWordTimings: WordTiming[] = []
    const chapterTimings: ChapterTiming[] = []
    const audioBuffers: Buffer[] = []
    let cumulativeOffset = 0

    for (const chapter of chapters) {
      logger.info(
        { chapterIndex: chapter.chapterIndex, title: chapter.title },
        'Synthesizing chapter'
      )

      const text = `${chapter.title}\n\n${chapter.content}`
      const result = await this.synthesizeChapter(text, chapter.chapterIndex)

      const adjustedWords = result.wordTimings.map((w) => ({
        ...w,
        audioOffset: w.audioOffset + cumulativeOffset,
      }))
      allWordTimings.push(...adjustedWords)

      chapterTimings.push({
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        startTime: cumulativeOffset,
        endTime: cumulativeOffset + result.duration,
      })

      cumulativeOffset += result.duration
      audioBuffers.push(result.audioBuffer)

      logger.info(
        { chapterIndex: chapter.chapterIndex, duration: result.duration },
        'Chapter completed'
      )
    }

    const finalBuffer = Buffer.concat(audioBuffers)
    const key = `${this.audioUrl}/${bookId}.mp3`
    await drive.use().put(key, finalBuffer)

    const timing: AudioTiming = {
      words: allWordTimings,
      chapters: chapterTimings,
      duration: cumulativeOffset,
    }

    logger.info({ bookId, totalDuration: cumulativeOffset }, 'Audio generation completed')

    return { audioUrl: key, timing }
  }

  /**
   * Map SDK cancellation to structured error details for logging.
   */
  private mapErrorDetails(reason: sdk.ResultReason, chapterIndex?: number): TtsErrorDetails {
    if (reason === sdk.ResultReason.Canceled) {
      return {
        code: 'canceled',
        message: 'Speech synthesis was canceled',
        provider: 'azure_tts',
        reason: 'Canceled',
        errorDetails: null,
        requestId: null,
        chapterIndex,
      }
    }
    return {
      code: 'synthesis_failed',
      message: 'Speech synthesis failed',
      provider: 'azure_tts',
      reason: reason.toString(),
      errorDetails: null,
      requestId: null,
      chapterIndex,
    }
  }

  private async synthesizeChapter(
    text: string,
    chapterIndex?: number
  ): Promise<{
    audioBuffer: Buffer
    wordTimings: WordTiming[]
    duration: number
  }> {
    return new Promise((resolve, reject) => {
      const wordTimings: WordTiming[] = []
      const synthesizer = new sdk.SpeechSynthesizer(
        this.speechConfig,
        null as unknown as sdk.AudioConfig
      )

      synthesizer.wordBoundary = (
        _s: sdk.SpeechSynthesizer,
        e: sdk.SpeechSynthesisWordBoundaryEventArgs
      ) => {
        if (e.boundaryType === sdk.SpeechSynthesisBoundaryType.Word) {
          wordTimings.push({
            word: e.text,
            audioOffset: speechSdkTicksToMs(e.audioOffset),
            duration: speechSdkTicksToMs(e.duration),
            textOffset: e.textOffset,
            wordLength: e.wordLength,
          })
        }
      }

      synthesizer.speakTextAsync(
        text,
        (result: sdk.SpeechSynthesisResult) => {
          synthesizer.close()

          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve({
              audioBuffer: Buffer.from(result.audioData),
              wordTimings,
              duration: speechSdkTicksToMs(result.audioDuration),
            })
          } else {
            const errorDetails = this.mapErrorDetails(result.reason, chapterIndex)
            const error = new Error(errorDetails.message)
            // Attach error details for logging
            ;(error as unknown as { ttsError: TtsErrorDetails }).ttsError = errorDetails
            reject(error)
          }
        },
        (err: string) => {
          synthesizer.close()
          const errorDetails = this.mapErrorDetails(sdk.ResultReason.Canceled, chapterIndex)
          const error = new Error(err)
          ;(error as unknown as { ttsError: TtsErrorDetails }).ttsError = errorDetails
          reject(error)
        }
      )
    })
  }
}
