import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import AudioPlayer from '@/components/shared/AudioPlayer.vue'

const ButtonStub = defineComponent({
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
})

const SliderStub = defineComponent({
  props: {
    modelValue: {
      type: Array,
      default: () => [0],
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  template: `
    <input
      data-test="slider"
      type="range"
      :disabled="disabled"
      :value="modelValue[0]"
      @input="$emit('update:modelValue', [Number($event.target.value)])"
    >
  `,
})

function mountAudioPlayer(props?: Record<string, unknown>) {
  return mount(AudioPlayer, {
    props: {
      variant: 'full',
      audioStatus: 'completed',
      isPlaying: false,
      currentTime: 30,
      duration: 180,
      ...props,
    },
    global: {
      stubs: {
        Button: ButtonStub,
        Slider: SliderStub,
      },
    },
  })
}

describe('AudioPlayer', () => {
  it('enables playback controls when status is completed', () => {
    const wrapper = mountAudioPlayer()

    const buttons = wrapper.findAll('button')
    expect(buttons[0]?.attributes('disabled')).toBeUndefined()
    expect(buttons[1]?.attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-test="slider"]').attributes('disabled')).toBeUndefined()
  })

  it('emits play when clicking the play button while paused', async () => {
    const wrapper = mountAudioPlayer({
      isPlaying: false,
    })

    await wrapper.findAll('button')[0]?.trigger('click')

    expect(wrapper.emitted('play')).toHaveLength(1)
  })

  it('emits pause when clicking the play button while playing', async () => {
    const wrapper = mountAudioPlayer({
      isPlaying: true,
    })

    await wrapper.findAll('button')[0]?.trigger('click')

    expect(wrapper.emitted('pause')).toHaveLength(1)
  })

  it('emits replay when clicking the replay button', async () => {
    const wrapper = mountAudioPlayer()

    await wrapper.findAll('button')[1]?.trigger('click')

    expect(wrapper.emitted('replay')).toHaveLength(1)
  })

  it('emits seek with computed seconds when the slider updates', async () => {
    const wrapper = mountAudioPlayer({
      duration: 180,
    })

    await wrapper.get('[data-test="slider"]').setValue(50)

    expect(wrapper.emitted('seek')).toEqual([[90]])
  })

  it('shows a loader and disables remaining controls when status is pending', () => {
    const wrapper = mountAudioPlayer({
      audioStatus: 'pending',
    })

    expect(wrapper.find('.animate-spin').exists()).toBe(true)
    expect(wrapper.findAll('button')[0]?.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="slider"]').attributes('disabled')).toBeDefined()
  })

  it('shows a loader and disables remaining controls when status is processing', () => {
    const wrapper = mountAudioPlayer({
      audioStatus: 'processing',
    })

    expect(wrapper.find('.animate-spin').exists()).toBe(true)
    expect(wrapper.findAll('button')[0]?.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="slider"]').attributes('disabled')).toBeDefined()
  })

  it('shows failure state and disables remaining controls when status is failed', () => {
    const wrapper = mountAudioPlayer({
      audioStatus: 'failed',
    })

    expect(wrapper.find('.text-destructive').exists()).toBe(true)
    expect(wrapper.findAll('button')[0]?.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="slider"]').attributes('disabled')).toBeDefined()
  })

  it('formats current time and duration as m:ss', () => {
    const wrapper = mountAudioPlayer({
      currentTime: 90,
      duration: 180,
    })

    const times = wrapper.findAll('span.text-xs')
    expect(times[0]?.text()).toBe('1:30')
    expect(times[1]?.text()).toBe('3:00')
  })

  it('pads seconds with a leading zero', () => {
    const wrapper = mountAudioPlayer({
      currentTime: 65,
      duration: 125,
    })

    const times = wrapper.findAll('span.text-xs')
    expect(times[0]?.text()).toBe('1:05')
    expect(times[1]?.text()).toBe('2:05')
  })
})
