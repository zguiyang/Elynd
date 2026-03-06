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
