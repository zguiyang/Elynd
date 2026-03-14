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
  GenerateChapterAudioOptions,
  TtsErrorDetails,
  SynthesizedChunkResult,
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
   * Uses text chunking for long chapters to prevent Azure TTS failures.
   */
  async generateChapterAudio(
    chapter: ChapterInput,
    bookId: number,
    options?: GenerateChapterAudioOptions
  ): Promise<ChapterAudioResult> {
    const startTime = Date.now()
    const textLength = chapter.content.length
    const voiceName = this.speechConfig.speechSynthesisVoiceName || 'default'
    const maxChunkChars = env.get('BOOK_AUDIO_CHUNK_MAX_CHARS', 3500)

    logger.info(
      {
        bookId,
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        textLength,
        provider: 'azure_tts',
        voiceName,
        maxChunkChars,
      },
      'Generating chapter audio'
    )

    const text = this.buildChapterText(chapter)
    const chunks = this.splitTextIntoChunks(text, maxChunkChars)

    logger.info(
      {
        bookId,
        chapterIndex: chapter.chapterIndex,
        chunkCount: chunks.length,
      },
      'Chapter text split into chunks'
    )

    const results: SynthesizedChunkResult[] = []

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      await options?.beforeChunkSynthesis?.(chunkIndex, chunks.length)
      const chunk = chunks[chunkIndex]
      logger.info(
        {
          bookId,
          chapterIndex: chapter.chapterIndex,
          chunkIndex,
          chunkCount: chunks.length,
          chunkLength: chunk.length,
        },
        'Synthesizing chapter audio chunk'
      )

      const result = await this.synthesizeTextChunk(chunk, chapter.chapterIndex)
      results.push(result)
    }

    const merged = this.mergeChunkResults(results)

    const elapsedMs = Date.now() - startTime

    // Generate deterministic path: book/voices/{bookId}/chapter-{chapterIndex}.mp3
    const audioPath = `${this.audioUrl}/${bookId}/chapter-${chapter.chapterIndex}.mp3`
    await drive.use().put(audioPath, merged.audioBuffer)

    logger.info(
      {
        bookId,
        chapterIndex: chapter.chapterIndex,
        durationMs: merged.duration,
        elapsedMs,
        audioPath,
        chunkCount: chunks.length,
      },
      'Chapter audio generated successfully'
    )

    return {
      chapterIndex: chapter.chapterIndex,
      audioPath,
      duration: merged.duration,
      timing: {
        words: merged.wordTimings,
      },
    }
  }

  /**
   * Build full chapter text from title and content.
   */
  private buildChapterText(chapter: ChapterInput): string {
    return `${chapter.title}\n\n${chapter.content}`
  }

  /**
   * Split text into chunks, preserving paragraph boundaries where possible.
   * Uses a conservative approach:
   * 1. First split by blank-line paragraph boundaries
   * 2. If a paragraph exceeds maxChars, split by sentence punctuation
   * 3. If a sentence still exceeds maxChars, hard-split by character length
   */
  private splitTextIntoChunks(text: string, maxChars: number): string[] {
    const chunks: string[] = []

    // Split by blank lines (paragraph boundaries)
    const paragraphs = text.split(/\n\s*\n/)

    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxChars) {
        if (paragraph.trim()) {
          chunks.push(paragraph.trim())
        }
        continue
      }

      // Paragraph exceeds maxChars, try sentence splitting
      const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph]

      let currentChunk = ''
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxChars) {
          currentChunk += sentence
        } else {
          // Current chunk is full
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim())
          }

          // If single sentence exceeds maxChars, hard split
          if (sentence.length > maxChars) {
            let remaining = sentence
            while (remaining.length > maxChars) {
              chunks.push(remaining.slice(0, maxChars))
              remaining = remaining.slice(maxChars)
            }
            currentChunk = remaining
          } else {
            currentChunk = sentence
          }
        }
      }

      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
      }
    }

    // Filter out empty chunks and trim
    return chunks.filter((chunk) => chunk.length > 0)
  }

  /**
   * Merge multiple chunk synthesis results into a single result.
   * Offsets word timings from later chunks by cumulative duration of prior chunks.
   */
  private mergeChunkResults(results: SynthesizedChunkResult[]): {
    audioBuffer: Buffer
    wordTimings: WordTiming[]
    duration: number
  } {
    if (results.length === 0) {
      return {
        audioBuffer: Buffer.alloc(0),
        wordTimings: [],
        duration: 0,
      }
    }

    if (results.length === 1) {
      return {
        audioBuffer: results[0].audioBuffer,
        wordTimings: results[0].wordTimings,
        duration: results[0].duration,
      }
    }

    const audioBuffers: Buffer[] = []
    const mergedWordTimings: WordTiming[] = []
    let cumulativeOffset = 0

    for (const result of results) {
      audioBuffers.push(result.audioBuffer)

      // Offset word timings by cumulative duration
      const offsetWords = result.wordTimings.map((w) => ({
        ...w,
        audioOffset: w.audioOffset + cumulativeOffset,
      }))
      mergedWordTimings.push(...offsetWords)

      cumulativeOffset += result.duration
    }

    return {
      audioBuffer: Buffer.concat(audioBuffers),
      wordTimings: mergedWordTimings,
      duration: cumulativeOffset,
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
      const result = await this.synthesizeTextChunk(text, chapter.chapterIndex)

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

  private async synthesizeTextChunk(
    text: string,
    chapterIndex?: number
  ): Promise<SynthesizedChunkResult> {
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
