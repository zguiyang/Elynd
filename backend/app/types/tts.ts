export type AudioStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface TtsRequest {
  text: string
  responseFormat?: string
  lengthScale?: number
}

export interface PiperTtsResponse {
  success: boolean
  data?: {
    filename: string
    url: string
  }
  error?: string
}

export interface AudioTiming {
  chapters: Array<{
    startTime: number
    endTime: number
    chapterIndex: number
    title: string
  }>
}

export interface TtsResult {
  audioUrl: string
  timing: AudioTiming | null
}
