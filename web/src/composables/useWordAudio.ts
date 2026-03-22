import { onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { wordAudioApi } from '@/api/word-audio'
import { toAudioSrc } from '@/lib/audio'

type WordAudioStatus = 'idle' | 'loading' | 'playing'

export function useWordAudio() {
  const state = ref<{
    word: string | null
    status: WordAudioStatus
  }>({
    word: null,
    status: 'idle',
  })

  let audioElement: HTMLAudioElement | null = null

  const resetState = () => {
    state.value = {
      word: null,
      status: 'idle',
    }
  }

  const stopWordAudio = () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
      audioElement.onended = null
      audioElement.onerror = null
      audioElement = null
    }

    resetState()
  }

  const playWordAudio = async (word: string) => {
    const normalizedWord = word.trim()
    if (!normalizedWord) {
      return
    }

    state.value = {
      word: normalizedWord,
      status: 'loading',
    }

    try {
      const response = await wordAudioApi.getWordAudio(normalizedWord)
      const audioSrc = toAudioSrc(response.audio)

      if (!audioSrc) {
        throw new Error('empty-audio-src')
      }

      stopWordAudio()

      const nextAudioElement = new Audio(audioSrc)
      nextAudioElement.preload = 'auto'
      nextAudioElement.onended = () => {
        audioElement = null
        resetState()
      }
      nextAudioElement.onerror = () => {
        audioElement = null
        resetState()
        toast.error('单词发音播放失败，请重试')
      }

      audioElement = nextAudioElement
      await nextAudioElement.play()

      state.value = {
        word: normalizedWord,
        status: 'playing',
      }
    } catch {
      stopWordAudio()
      toast.error('单词发音播放失败，请重试')
    }
  }

  const isWordAudioLoading = (word: string) => {
    return state.value.word === word && state.value.status === 'loading'
  }

  const isWordAudioPlaying = (word: string) => {
    return state.value.word === word && state.value.status === 'playing'
  }

  onUnmounted(() => {
    stopWordAudio()
  })

  return {
    playWordAudio,
    stopWordAudio,
    isWordAudioLoading,
    isWordAudioPlaying,
  }
}
