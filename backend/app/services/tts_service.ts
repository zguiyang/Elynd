import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import drive from '@adonisjs/drive/services/main'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import { speechSdkTicksToMs } from '#services/speech_sdk_time'
import type { TtsResult, AudioTiming, WordTiming, ChapterTiming, ChapterInput } from '#types/tts'

@inject()
export class TtsService {
  private speechConfig: sdk.SpeechConfig
  private readonly audioUrl: string = 'article/voices'

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

  async generateAudio(chapters: ChapterInput[], articleId: number): Promise<TtsResult> {
    logger.info(`Generating audio for article ${articleId}, ${chapters.length} chapters`)

    const allWordTimings: WordTiming[] = []
    const chapterTimings: ChapterTiming[] = []
    const audioBuffers: Buffer[] = []
    let cumulativeOffset = 0

    for (const chapter of chapters) {
      logger.info(`Synthesizing chapter ${chapter.chapterIndex}: ${chapter.title}`)

      const text = `${chapter.title}\n\n${chapter.content}`
      const result = await this.synthesizeChapter(text)

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

      logger.info(`Chapter ${chapter.chapterIndex} completed, duration: ${result.duration}ms`)
    }

    const finalBuffer = Buffer.concat(audioBuffers)
    const key = `${this.audioUrl}/${articleId}.mp3`
    await drive.use().put(key, finalBuffer)

    const timing: AudioTiming = {
      words: allWordTimings,
      chapters: chapterTimings,
      duration: cumulativeOffset,
    }

    logger.info(`Audio generated for article ${articleId}, total duration: ${cumulativeOffset}ms`)

    return { audioUrl: key, timing }
  }

  private async synthesizeChapter(text: string): Promise<{
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
            const errorDetails =
              result.reason === sdk.ResultReason.Canceled
                ? 'Speech synthesis canceled'
                : 'Speech synthesis failed'
            reject(new Error(errorDetails))
          }
        },
        (err: string) => {
          synthesizer.close()
          reject(new Error(err))
        }
      )
    })
  }
}
