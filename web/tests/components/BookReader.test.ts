import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BookReader from '@/components/shared/BookReader.vue'

vi.mock('@/api/dictionary', () => ({
  lookupWord: vi.fn(),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

import { lookupWord } from '@/api/dictionary'
import { toast } from 'vue-sonner'

const ButtonStub = defineComponent({
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click', 'mousedown'],
  template: '<button v-bind="$attrs" :disabled="disabled" @mousedown="$emit(\'mousedown\', $event)" @click="$emit(\'click\', $event)"><slot /></button>',
})

const MarkdownRendererStub = defineComponent({
  props: {
    content: {
      type: String,
      default: '',
    },
  },
  template: '<div data-test="markdown-renderer">{{ content }}</div>',
})

const createRangeFromReader = (wrapper: ReturnType<typeof mount>) => {
  const paragraph = wrapper.find('p').element
  const textNode = paragraph.firstChild as Text
  const range = document.createRange()
  range.setStart(textNode, 0)
  range.setEnd(textNode, 5)
  return range
}

const mockSelection = (options: { text: string; range: Range; collapsed?: boolean }) => {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    rangeCount: 1,
    isCollapsed: options.collapsed ?? false,
    toString: () => options.text,
    getRangeAt: () => options.range,
  } as unknown as Selection)
}

const mountBookReader = () => {
  setActivePinia(createPinia())

  return mount(BookReader, {
    props: {
      paragraphs: ['hello world'],
      chapterTitle: 'Chapter 1',
    },
    global: {
      stubs: {
        Button: ButtonStub,
        MarkdownRenderer: MarkdownRendererStub,
      },
    },
  })
}

describe('BookReader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows action surface when selection text length is greater than zero', async () => {
    const wrapper = mountBookReader()
    const range = createRangeFromReader(wrapper)
    mockSelection({ text: 'hello', range })

    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()

    expect(wrapper.find('[data-test="reader-action-surface"]').exists()).toBe(true)
  })

  it('hides action surface when selection collapses', async () => {
    const wrapper = mountBookReader()
    const range = createRangeFromReader(wrapper)
    mockSelection({ text: 'hello', range })
    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()
    expect(wrapper.find('[data-test="reader-action-surface"]').exists()).toBe(true)

    mockSelection({ text: '', range, collapsed: true })
    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()

    expect(wrapper.find('[data-test="reader-action-surface"]').exists()).toBe(false)
  })

  it('renders divider between lookup action and ai actions', async () => {
    const wrapper = mountBookReader()
    const range = createRangeFromReader(wrapper)
    mockSelection({ text: 'hello', range })

    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()

    expect(wrapper.find('[data-test="reader-lookup-divider"]').exists()).toBe(true)
  })

  it('disables lookup for invalid non-single-word selection', async () => {
    const wrapper = mountBookReader()
    const range = createRangeFromReader(wrapper)
    mockSelection({ text: 'hello world', range })

    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()

    expect(wrapper.find('[data-test="reader-lookup-button"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-test="reader-lookup-button"]').trigger('click')
    expect(toast.error).toHaveBeenCalledWith('查词仅支持一个完整英文单词')
  })

  it('shows toast and blocks action execution when selection exceeds max length', async () => {
    const wrapper = mountBookReader()
    const range = createRangeFromReader(wrapper)
    const longText = 'a'.repeat(501)
    mockSelection({ text: longText, range })

    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()
    await wrapper.find('[data-test="reader-lookup-button"]').trigger('click')

    expect(toast.error).toHaveBeenCalled()
    expect(lookupWord).not.toHaveBeenCalled()
  })

  it('emits selection-action for ai actions', async () => {
    const wrapper = mountBookReader()
    const range = createRangeFromReader(wrapper)
    mockSelection({ text: 'hello', range })

    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()
    await wrapper.get('[data-test="reader-explain-button"]').trigger('click')

    expect(wrapper.emitted('selection-action')?.[0]?.[0]).toEqual(expect.objectContaining({
      actionType: 'explain',
      selectedText: 'hello',
    }))
  })
})
