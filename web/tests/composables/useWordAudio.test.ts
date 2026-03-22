import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useWordAudio } from '@/composables/useWordAudio'

vi.mock('@/api/word-audio', () => ({
  wordAudioApi: {
    getWordAudio: vi.fn(),
  },
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

import { wordAudioApi } from '@/api/word-audio'

function mountUseWordAudio() {
  const Harness = defineComponent({
    setup(_, { expose }) {
      const state = useWordAudio()
      expose(state)
      return () => null
    },
  })

  const wrapper = mount(Harness)
  return {
    wrapper,
    exposed: wrapper.vm as unknown as ReturnType<typeof useWordAudio>,
  }
}

describe('useWordAudio', () => {
  const fakeAudio = {
    preload: '',
    src: '',
    onended: null as null | (() => void),
    onerror: null as null | (() => void),
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('Audio', vi.fn(() => fakeAudio))
  })

  it('fetches audio, normalizes the src, and plays it', async () => {
    vi.mocked(wordAudioApi.getWordAudio).mockResolvedValue({
      audio: 'QUJDRA==',
    } as never)

    const { exposed, wrapper } = mountUseWordAudio()

    await exposed.playWordAudio('Hello!')
    await flushPromises()

    expect(wordAudioApi.getWordAudio).toHaveBeenCalledWith('Hello!')
    expect(globalThis.Audio).toHaveBeenCalledWith('data:audio/mp3;base64,QUJDRA==')
    expect(fakeAudio.play).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('resets state when audio playback ends', async () => {
    vi.mocked(wordAudioApi.getWordAudio).mockResolvedValue({
      audio: 'data:audio/mp3;base64,QUJDRA==',
    } as never)

    const { exposed, wrapper } = mountUseWordAudio()

    await exposed.playWordAudio('hello')
    await flushPromises()

    expect(exposed.isWordAudioPlaying('hello')).toBe(true)
    fakeAudio.onended?.()
    expect(exposed.isWordAudioPlaying('hello')).toBe(false)

    wrapper.unmount()
  })
})
