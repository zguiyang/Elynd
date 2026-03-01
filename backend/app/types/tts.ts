export type AudioStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface WordTiming {
  word: string
  audioOffset: number
  duration: number
  textOffset: number
  wordLength: number
}

export interface ChapterTiming {
  chapterIndex: number
  title: string
  startTime: number
  endTime: number
}

export interface AudioTiming {
  words: WordTiming[]
  chapters: ChapterTiming[]
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
