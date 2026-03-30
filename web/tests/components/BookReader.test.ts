import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
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

const DialogStub = defineComponent({
  props: {
    open: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:open'],
  template: '<div v-if="open"><slot /></div>',
})

const DialogContentStub = defineComponent({
  template: '<div><slot /></div>',
})

const DialogDescriptionStub = defineComponent({
  template: '<div><slot /></div>',
})

const DialogHeaderStub = defineComponent({
  template: '<div><slot /></div>',
})

const DialogTitleStub = defineComponent({
  template: '<div><slot /></div>',
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
      bookId: 12,
      chapterIndex: 4,
      currentTime: 0,
    } as any,
    global: {
      stubs: {
        Button: ButtonStub,
        MarkdownRenderer: MarkdownRendererStub,
        Dialog: DialogStub,
        DialogContent: DialogContentStub,
        DialogDescription: DialogDescriptionStub,
        DialogHeader: DialogHeaderStub,
        DialogTitle: DialogTitleStub,
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

  it('passes chapter context to lookupWord and renders enriched dictionary result', async () => {
    const wrapper = mountBookReader()
    const range = createRangeFromReader(wrapper)
    mockSelection({ text: 'apple', range })

    vi.mocked(lookupWord).mockResolvedValue({
      word: 'apple',
      phonetic: '/ˈæp.əl/',
      meanings: [
        {
          partOfSpeech: 'noun',
          localizedMeaning: '苹果',
          explanation: '就是一种常见水果，日常生活里很常见。',
          examples: [
            {
              sourceText: 'An apple a day keeps the doctor away.',
              localizedText: '一天一个苹果，医生远离我。',
              source: 'dictionary',
            },
          ],
        },
      ],
      meta: {
        source: 'dictionary_plus_ai',
        localizationLanguage: 'zh-CN',
      },
    } as never)

    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()
    await wrapper.get('[data-test="reader-lookup-button"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(lookupWord).toHaveBeenCalledWith('apple', {
      bookId: 12,
      chapterIndex: 4,
    })
    const result = wrapper.get('[data-test="reader-lookup-result"]')
    expect(result.text()).toContain('apple')
    expect(result.text()).toContain('苹果')
    expect(result.text()).toContain('就是一种常见水果')
    expect(result.text()).toContain('一天一个苹果，医生远离我。')
  })

  it('renders lookup result even when meaning examples are missing', async () => {
    const wrapper = mountBookReader()
    const range = createRangeFromReader(wrapper)
    mockSelection({ text: 'pear', range })

    vi.mocked(lookupWord).mockResolvedValue({
      word: 'pear',
      phonetic: '/peər/',
      meanings: [
        {
          partOfSpeech: 'noun',
          localizedMeaning: '梨',
          explanation: '一种水果',
        },
      ],
      meta: {
        source: 'dictionary',
        localizationLanguage: 'zh-CN',
      },
    } as never)

    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()
    await wrapper.get('[data-test="reader-lookup-button"]').trigger('click')
    await flushPromises()
    await nextTick()

    const result = wrapper.get('[data-test="reader-lookup-result"]')
    expect(result.text()).toContain('pear')
    expect(result.text()).toContain('梨')
    expect(result.text()).toContain('一种水果')
  })

  it('renders unified lookup error message when lookupWord fails', async () => {
    const wrapper = mountBookReader()
    const range = createRangeFromReader(wrapper)
    mockSelection({ text: 'grape', range })

    vi.mocked(lookupWord).mockRejectedValue({
      status: 503,
      message: '查询失败，请稍后重试',
    })

    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()
    await wrapper.get('[data-test="reader-lookup-button"]').trigger('click')
    await flushPromises()
    await nextTick()

    const error = wrapper.get('[data-test="reader-lookup-error"]')
    expect(error.text()).toContain('查询失败，请稍后重试')
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

  it('highlights active sentence with timing mapping based on currentTime', async () => {
    const wrapper = mount(BookReader, {
      props: {
        paragraphs: [],
        chapterTitle: 'Chapter 1',
        currentTime: 1.2,
        sentenceTimings: [
          {
            paragraphIndex: 0,
            sentenceIndex: 0,
            text: 'Hello world.',
            startMs: 100,
            endMs: 700,
          },
          {
            paragraphIndex: 0,
            sentenceIndex: 1,
            text: 'Bye now.',
            startMs: 900,
            endMs: 1500,
          },
        ],
      } as any,
      global: {
        stubs: {
          Button: ButtonStub,
          Dialog: DialogStub,
          DialogContent: DialogContentStub,
          DialogDescription: DialogDescriptionStub,
          DialogHeader: DialogHeaderStub,
          DialogTitle: DialogTitleStub,
        },
      },
    })

    const active = wrapper.find('[data-test="reader-sentence-active"]')
    expect(active.exists()).toBe(true)
    expect(active.text()).toContain('Bye now.')
    expect(wrapper.text()).toContain('Chapter 1')
  })

  it('keeps previous sentence active briefly near boundary before switching', async () => {
    const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const wrapper = mount(BookReader, {
      props: {
        paragraphs: [],
        chapterTitle: 'Chapter 1',
        currentTime: 0.95,
        sentenceTimings: [
          {
            paragraphIndex: 0,
            sentenceIndex: 0,
            text: 'First sentence.',
            startMs: 0,
            endMs: 1000,
          },
          {
            paragraphIndex: 0,
            sentenceIndex: 1,
            text: 'Second sentence.',
            startMs: 1000,
            endMs: 1800,
          },
        ],
      } as any,
      global: {
        stubs: {
          Button: ButtonStub,
          Dialog: DialogStub,
          DialogContent: DialogContentStub,
          DialogDescription: DialogDescriptionStub,
          DialogHeader: DialogHeaderStub,
          DialogTitle: DialogTitleStub,
        },
      },
    })

    expect(wrapper.get('[data-test="reader-sentence-active"]').text()).toContain('First sentence.')

    await wrapper.setProps({ currentTime: 1.05 })
    await nextTick()
    expect(wrapper.get('[data-test="reader-sentence-active"]').text()).toContain('First sentence.')

    await wrapper.setProps({ currentTime: 1.13 })
    await nextTick()
    expect(wrapper.get('[data-test="reader-sentence-active"]').text()).toContain('Second sentence.')
    scrollBySpy.mockRestore()
  })

  it('soft-follows active sentence on sentence switch', async () => {
    const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const element = this as HTMLElement
      const key = element.dataset?.sentenceKey
      if (key === '0-1') {
        return {
          x: 0,
          y: 980,
          top: 980,
          left: 0,
          right: 400,
          bottom: 1020,
          width: 400,
          height: 40,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 120,
        top: 120,
        left: 0,
        right: 400,
        bottom: 160,
        width: 400,
        height: 40,
        toJSON: () => ({}),
      } as DOMRect
    })

    const wrapper = mount(BookReader, {
      props: {
        paragraphs: [],
        currentTime: 0.4,
        sentenceTimings: [
          {
            paragraphIndex: 0,
            sentenceIndex: 0,
            text: 'First sentence.',
            startMs: 0,
            endMs: 900,
          },
          {
            paragraphIndex: 0,
            sentenceIndex: 1,
            text: 'Second sentence.',
            startMs: 1000,
            endMs: 1900,
          },
        ],
      } as any,
      global: {
        stubs: {
          Button: ButtonStub,
          Dialog: DialogStub,
          DialogContent: DialogContentStub,
          DialogDescription: DialogDescriptionStub,
          DialogHeader: DialogHeaderStub,
          DialogTitle: DialogTitleStub,
        },
      },
    })

    await wrapper.setProps({ currentTime: 1.2 })
    await nextTick()

    expect(scrollBySpy).toHaveBeenCalled()
    rectSpy.mockRestore()
    scrollBySpy.mockRestore()
  })
})
