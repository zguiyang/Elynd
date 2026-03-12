export type AudioStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface WordTiming {
  word: string
  /** Word start time (ms) in the final, concatenated audio. */
  audioOffset: number
  /** Word duration (ms). */
  duration: number
  textOffset: number
  wordLength: number
}

export interface ChapterTiming {
  chapterIndex: number
  title: string
  /** Chapter start time (ms) in the final, concatenated audio. */
  startTime: number
  /** Chapter end time (ms) in the final, concatenated audio. */
  endTime: number
}

export interface AudioTiming {
  words: WordTiming[]
  chapters: ChapterTiming[]
  /** Total duration (ms) of the final, concatenated audio. */
  duration: number
}

export interface TtsResult {
  audioUrl: string
  timing: AudioTiming
}

export interface ChapterInput {
  chapterIndex: number
  title: string
  content: string
}

/**
 * Result of generating audio for a single chapter.
 * Each chapter gets its own audio file with deterministic path.
 */
export interface ChapterAudioResult {
  /** Index of the chapter in the book (0-based). */
  chapterIndex: number
  /** Local path to the audio file (deterministic based on bookId and chapterIndex). */
  audioPath: string
  /** Duration of the chapter audio in milliseconds. */
  duration: number
  /** Timing metadata for words in this chapter. */
  timing: {
    words: WordTiming[]
  }
}

/**
 * Error details from TTS processing, structured for logging.
 */
export interface TtsErrorDetails {
  code: 'canceled' | 'synthesis_failed' | 'unknown'
  message: string
  provider: 'azure_tts'
  reason: string | null
  errorDetails: string | null
  requestId: string | null
  chapterIndex?: number
}

/**
 * Result of synthesizing a single text chunk.
 * Used internally for chunked chapter synthesis.
 */
export interface SynthesizedChunkResult {
  audioBuffer: Buffer
  wordTimings: WordTiming[]
  duration: number
}
