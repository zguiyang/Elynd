import { request } from '@/lib/request'

export interface WordAudioResponse {
  audio: string
}

export const wordAudioApi = {
  getWordAudio: (word: string) =>
    request<WordAudioResponse>({ method: 'GET', url: `/api/word-audio/${encodeURIComponent(word)}` }),
}
