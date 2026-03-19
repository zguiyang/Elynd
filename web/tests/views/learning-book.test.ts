import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LearningBook from '@/views/learning/learning-book.vue'
import type { Book, Chapter } from '@/types/book'

vi.mock('@/api/book', () => ({
  bookApi: {
    getVocabulary: vi.fn(),
  },
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => ({
      params: {
        id: '12',
      },
    }),
  }
})

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

import { bookApi } from '@/api/book'
import { toast } from 'vue-sonner'

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

const BookReaderStub = defineComponent({
  props: {
    paragraphs: {
      type: Array,
      default: () => [],
    },
    chapterTitle: {
      type: String,
      default: '',
    },
  },
  template: `
    <div data-test="book-reader">
      <span data-test="chapter-title">{{ chapterTitle }}</span>
      <span data-test="paragraph-count">{{ paragraphs.length }}</span>
      <span data-test="first-paragraph">{{ paragraphs[0] }}</span>
    </div>
  `,
})

const DialogStub = defineComponent({
  props: {
    open: {
      type: Boolean,
      default: false,
    },
  },
  template: '<div v-if="open" data-test="dialog"><slot /></div>',
})

const DialogContentStub = defineComponent({
  template: '<div data-test="dialog-content"><slot /></div>',
})

const VocabularyPreviewStub = defineComponent({
  props: {
    vocabularies: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['close'],
  template: '<div data-test="vocabulary-preview">{{ vocabularies.length }}</div>',
})

const DropdownMenuStub = defineComponent({ template: '<div><slot /></div>' })
const DropdownMenuTriggerStub = defineComponent({ template: '<div><slot /></div>' })
const DropdownMenuContentStub = defineComponent({ template: '<div />' })
const DropdownMenuItemStub = defineComponent({ template: '<div />' })

const createMockBook = (): Book => ({
  id: 12,
  title: 'Test Book',
  source: 'user_uploaded',
  author: null,
  description: null,
  difficultyLevel: 'L1',
  status: 'ready',
  processingStep: null,
  processingProgress: 100,
  processingError: null,
  wordCount: 1000,
  readingTime: 120,
  isPublished: true,
  createdBy: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  tags: [],
  chapters: [
    { id: 1, chapterIndex: 0, title: 'Chapter 1' },
    { id: 2, chapterIndex: 1, title: 'Chapter 2' },
  ],
  audioUrl: null,
  audioStatus: null,
})

const createMockChapter = (): Chapter => ({
  id: 101,
  chapterIndex: 0,
  title: 'Chapter 1',
  content: 'Paragraph 1\n\nParagraph 2',
  audioUrl: null,
  audioStatus: null,
  audioDurationMs: null,
})

function mountLearningBook(props?: Record<string, unknown>) {
  setActivePinia(createPinia())

  return mount(LearningBook, {
    props: {
      book: createMockBook(),
      chapter: createMockChapter(),
      currentChapterIndex: 0,
      isPlaying: false,
      currentTime: 45,
      duration: 180,
      ...props,
    },
    global: {
      stubs: {
        Button: ButtonStub,
        BookReader: BookReaderStub,
        Dialog: DialogStub,
        DialogContent: DialogContentStub,
        VocabularyPreview: VocabularyPreviewStub,
        DropdownMenu: DropdownMenuStub,
        DropdownMenuTrigger: DropdownMenuTriggerStub,
        DropdownMenuContent: DropdownMenuContentStub,
        DropdownMenuItem: DropdownMenuItemStub,
      },
    },
  })
}

describe('learning-book.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('splits chapter content into paragraphs and passes them to BookReader', () => {
    const wrapper = mountLearningBook()

    expect(wrapper.get('[data-test="chapter-title"]').text()).toBe('Chapter 1')
    expect(wrapper.get('[data-test="paragraph-count"]').text()).toBe('2')
    expect(wrapper.get('[data-test="first-paragraph"]').text()).toBe('Paragraph 1')
  })

  it('emits the previous chapter index when clicking previous chapter', async () => {
    const wrapper = mountLearningBook({
      currentChapterIndex: 1,
    })

    const buttons = wrapper.findAll('button')
    await buttons[3]?.trigger('click')

    expect(wrapper.emitted('update:currentChapterIndex')).toEqual([[0]])
  })

  it('emits the next chapter index when clicking next chapter', async () => {
    const wrapper = mountLearningBook({
      currentChapterIndex: 0,
    })

    const buttons = wrapper.findAll('button')
    await buttons[4]?.trigger('click')

    expect(wrapper.emitted('update:currentChapterIndex')).toEqual([[1]])
  })

  it('emits play when the play button is clicked while paused', async () => {
    const wrapper = mountLearningBook({
      isPlaying: false,
    })

    const buttons = wrapper.findAll('button')
    await buttons[5]?.trigger('click')

    expect(wrapper.emitted('update:isPlaying')).toEqual([[true]])
    expect(wrapper.emitted('play')).toHaveLength(1)
  })

  it('emits pause when the play button is clicked while playing', async () => {
    const wrapper = mountLearningBook({
      isPlaying: true,
    })

    const buttons = wrapper.findAll('button')
    await buttons[5]?.trigger('click')

    expect(wrapper.emitted('update:isPlaying')).toEqual([[false]])
    expect(wrapper.emitted('pause')).toHaveLength(1)
  })

  it('emits replay and resets current time when the replay button is clicked', async () => {
    const wrapper = mountLearningBook()

    const buttons = wrapper.findAll('button')
    await buttons[6]?.trigger('click')

    expect(wrapper.emitted('update:currentTime')).toEqual([[0]])
    expect(wrapper.emitted('replay')).toHaveLength(1)
  })

  it('opens the vocabulary dialog after fetchVocabulary succeeds', async () => {
    vi.mocked(bookApi.getVocabulary).mockResolvedValue([
      { id: 1, word: 'test', meaning: '测试' },
    ] as any)

    const wrapper = mountLearningBook()

    await (wrapper.vm as unknown as { fetchVocabulary: () => Promise<void> }).fetchVocabulary()
    await flushPromises()

    expect(bookApi.getVocabulary).toHaveBeenCalledWith(12)
    expect(wrapper.find('[data-test="dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="vocabulary-preview"]').text()).toBe('1')
  })

  it('shows an error toast when fetchVocabulary fails', async () => {
    vi.mocked(bookApi.getVocabulary).mockRejectedValue(new Error('failed'))

    const wrapper = mountLearningBook()

    await (wrapper.vm as unknown as { fetchVocabulary: () => Promise<void> }).fetchVocabulary()
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('获取词汇失败')
    expect(wrapper.find('[data-test="dialog"]').exists()).toBe(false)
  })
})
