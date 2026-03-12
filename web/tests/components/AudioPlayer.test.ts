import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AudioPlayer from '@/components/shared/AudioPlayer.vue'

// Stub ResizeObserver and other browser APIs needed by reka/shadcn
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })))
  vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })))
})

describe('AudioPlayer', () => {
  describe('completed status', () => {
    it('should enable playback controls when status is completed', () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'completed',
          isPlaying: false,
          currentTime: 30,
          duration: 180,
        },
      })

      // 按钮应该不被禁用
      const playButton = wrapper.findAll('button')[0]
      expect(playButton.attributes('disabled')).toBeUndefined()
    })

    it('should emit play when play button is clicked while paused', async () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'completed',
          isPlaying: false,
          currentTime: 30,
          duration: 180,
        },
      })

      const playButton = wrapper.findAll('button')[0]
      await playButton.trigger('click')

      expect(wrapper.emitted('play')).toHaveLength(1)
    })

    it('should emit pause when pause button is clicked while playing', async () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'completed',
          isPlaying: true,
          currentTime: 30,
          duration: 180,
        },
      })

      const playButton = wrapper.findAll('button')[0]
      await playButton.trigger('click')

      expect(wrapper.emitted('pause')).toHaveLength(1)
    })

    it('should emit replay when replay button is clicked', async () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'completed',
          isPlaying: false,
          currentTime: 30,
          duration: 180,
        },
      })

      const replayButton = wrapper.findAll('button')[1]
      await replayButton.trigger('click')

      expect(wrapper.emitted('replay')).toHaveLength(1)
    })
  })

  describe('pending/processing status', () => {
    it('should show loader when status is pending', () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'pending',
          isPlaying: false,
          currentTime: 0,
          duration: 180,
        },
      })

      // Should show loader (Loader2 icon)
      expect(wrapper.find('.animate-spin').exists()).toBe(true)
    })

    it('should show loader when status is processing', () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'processing',
          isPlaying: false,
          currentTime: 0,
          duration: 180,
        },
      })

      expect(wrapper.find('.animate-spin').exists()).toBe(true)
    })

    it('should disable controls when status is pending', () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'pending',
          isPlaying: false,
          currentTime: 0,
          duration: 180,
        },
      })

      // When pending, loader is shown and buttons should be disabled
      expect(wrapper.find('.animate-spin').exists()).toBe(true)
      const replayButton = wrapper.findAll('button')[0]
      // Check that disabled attribute exists (even if value is empty string)
      expect(replayButton.attributes('disabled')).not.toBeUndefined()
    })
  })

  describe('failed status', () => {
    it('should show failure state when status is failed', () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'failed',
          isPlaying: false,
          currentTime: 0,
          duration: 180,
        },
      })

      // Should show alert icon with destructive class
      expect(wrapper.find('.text-destructive').exists()).toBe(true)
    })

    it('should disable controls when status is failed', () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'failed',
          isPlaying: false,
          currentTime: 0,
          duration: 180,
        },
      })

      // When failed, alert is shown and buttons should be disabled
      expect(wrapper.find('.text-destructive').exists()).toBe(true)
      const replayButton = wrapper.findAll('button')[0]
      // Check that disabled attribute exists (even if value is empty string)
      expect(replayButton.attributes('disabled')).not.toBeUndefined()
    })
  })

  describe('time formatting', () => {
    it('should format current time as m:ss', () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'completed',
          isPlaying: false,
          currentTime: 90, // 1:30
          duration: 180,   // 3:00
        },
      })

      const timeSpans = wrapper.findAll('span.text-xs')
      expect(timeSpans[0].text()).toBe('1:30')
    })

    it('should format duration as m:ss', () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'completed',
          isPlaying: false,
          currentTime: 90,
          duration: 180,
        },
      })

      const timeSpans = wrapper.findAll('span.text-xs')
      expect(timeSpans[1].text()).toBe('3:00')
    })

    it('should pad seconds with zero', () => {
      const wrapper = mount(AudioPlayer, {
        props: {
          variant: 'full',
          audioStatus: 'completed',
          isPlaying: false,
          currentTime: 65, // 1:05
          duration: 125,   // 2:05
        },
      })

      const timeSpans = wrapper.findAll('span.text-xs')
      expect(timeSpans[0].text()).toBe('1:05')
      expect(timeSpans[1].text()).toBe('2:05')
    })
  })
})
