import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import drive from '@adonisjs/drive/services/main'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import { speechSdkTicksToMs } from '#utils/speech_sdk_time'
import { TTS_CHUNK_STRATEGY } from '#constants'
import { buildCanonicalChapterText } from '#utils/book_text_normalizer'
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
    this.speechConfig.setProperty(sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary, 'true')
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
    const text = this.buildChapterText(chapter)
    const textLength = text.length
    const voiceName = this.getVoiceName(options)
    const maxChunkChars = this.computeAdaptiveChunkMaxChars(textLength)

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

      const result = await this.synthesizeTextChunk(chunk, chapter.chapterIndex, voiceName)
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
      chunkCount: chunks.length,
      timing: {
        words: merged.wordTimings,
      },
    }
  }

  getCurrentVoiceName() {
    return this.speechConfig.speechSynthesisVoiceName || 'default'
  }

  async synthesizeTextToBuffer(text: string, voiceName?: string): Promise<Buffer> {
    const result = await this.synthesizeTextChunk(text, undefined, voiceName)
    return result.audioBuffer
  }

  /**
   * Build full chapter text from title and content.
   */
  private buildChapterText(chapter: ChapterInput): string {
    return buildCanonicalChapterText(chapter.title, chapter.content)
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
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)

    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxChars) {
        chunks.push(paragraph)
        continue
      }

      const sentences = this.splitParagraphIntoSentences(paragraph)

      let currentChunk = ''
      for (const sentence of sentences) {
        if (!currentChunk) {
          if (sentence.length <= maxChars) {
            currentChunk = sentence
            continue
          }

          chunks.push(...this.hardSplitText(sentence, maxChars))
          continue
        }

        const candidate = `${currentChunk} ${sentence}`.trim()
        if (candidate.length <= maxChars) {
          currentChunk = candidate
        } else {
          chunks.push(currentChunk)
          if (sentence.length > maxChars) {
            chunks.push(...this.hardSplitText(sentence, maxChars))
            currentChunk = ''
          } else {
            currentChunk = sentence
          }
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk)
      }
    }

    return this.mergeSmallAdjacentChunks(chunks, maxChars)
  }

  private getVoiceName(options?: GenerateChapterAudioOptions) {
    return options?.voiceName || this.getCurrentVoiceName()
  }

  private computeAdaptiveChunkMaxChars(textLength: number) {
    const minCharsForMaxChunkCount = Math.ceil(textLength / TTS_CHUNK_STRATEGY.TARGET_CHUNK_MAX)
    const maxCharsForMinChunkCount = Math.ceil(textLength / TTS_CHUNK_STRATEGY.TARGET_CHUNK_MIN)
    const adaptiveMid = Math.round((minCharsForMaxChunkCount + maxCharsForMinChunkCount) / 2)

    return Math.max(
      TTS_CHUNK_STRATEGY.MIN_CHARS,
      Math.min(TTS_CHUNK_STRATEGY.MAX_CHARS, adaptiveMid)
    )
  }

  private splitParagraphIntoSentences(paragraph: string): string[] {
    return (
      paragraph
        .match(/[^.!?]+(?:[.!?]+|$)/g)
        ?.map((sentence) => sentence.trim())
        .filter(Boolean) || [paragraph]
    )
  }

  private hardSplitText(text: string, maxChars: number): string[] {
    const chunks: string[] = []
    let remaining = text.trim()

    while (remaining.length > maxChars) {
      const slice = remaining.slice(0, maxChars)
      const breakIndex = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\n'))

      if (breakIndex > Math.floor(maxChars * 0.6)) {
        chunks.push(slice.slice(0, breakIndex).trim())
        remaining = remaining.slice(breakIndex + 1).trim()
      } else {
        chunks.push(slice.trim())
        remaining = remaining.slice(maxChars).trim()
      }
    }

    if (remaining.length > 0) {
      chunks.push(remaining)
    }

    return chunks
  }

  /**
   * Merge adjacent small chunks to avoid over-fragmented chapters.
   * Deterministic: stable input order + fixed separator strategy.
   */
  private mergeSmallAdjacentChunks(chunks: string[], maxChars: number): string[] {
    if (chunks.length <= 1) {
      return chunks
    }

    const merged: string[] = []
    let current = ''

    for (const chunk of chunks) {
      if (!current) {
        current = chunk
        continue
      }

      const candidate = `${current}\n\n${chunk}`
      if (candidate.length <= maxChars) {
        current = candidate
        continue
      }

      merged.push(current)
      current = chunk
    }

    if (current) {
      merged.push(current)
    }

    return merged
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
      const result = await this.synthesizeTextChunk(
        text,
        chapter.chapterIndex,
        this.getCurrentVoiceName()
      )

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
    chapterIndex?: number,
    voiceName?: string
  ): Promise<SynthesizedChunkResult> {
    return new Promise((resolve, reject) => {
      const wordTimings: WordTiming[] = []
      this.speechConfig.speechSynthesisVoiceName = voiceName || this.getCurrentVoiceName()
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
