import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import AiChatPanel from '@/components/shared/AiChatPanel.vue'

const sendMessageMock = vi.fn()
const clearMessagesMock = vi.fn()

vi.mock('@/composables/useBookChat', () => ({
  useBookChat: () => ({
    messages: { value: [] },
    isLoading: { value: false },
    isWaitingForResponse: { value: false },
    sendMessage: sendMessageMock,
    clearMessages: clearMessagesMock,
  }),
}))

const DefaultStub = defineComponent({
  template: '<div><slot /></div>',
})

const TextareaStub = defineComponent({
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue', 'keydown'],
  template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keydown="$emit(\'keydown\', $event)" />',
})

describe('AiChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('openAndSend opens panel, clears messages, and sends message automatically', () => {
    const wrapper = mount(AiChatPanel, {
      props: {
        open: false,
        bookId: 1,
        bookTitle: 'Book',
      },
      global: {
        stubs: {
          Sheet: DefaultStub,
          SheetContent: DefaultStub,
          SheetHeader: DefaultStub,
          SheetTitle: DefaultStub,
          SheetClose: DefaultStub,
          SheetDescription: DefaultStub,
          Button: DefaultStub,
          Textarea: TextareaStub,
          MarkdownRenderer: DefaultStub,
          Skeleton: DefaultStub,
          Bot: DefaultStub,
          User: DefaultStub,
          Send: DefaultStub,
          Loader2: DefaultStub,
          Sparkles: DefaultStub,
        },
      },
    })

    ;(wrapper.vm as unknown as {
      openAndSend: (payload: {
        content: string
        actionType?: 'explain' | 'qa' | 'translate'
        chapterIndex?: number
      }) => void
    }).openAndSend({ content: 'Hello AI', actionType: 'qa', chapterIndex: 2 })

    expect(wrapper.emitted('update:open')?.[0]).toEqual([true])
    expect(clearMessagesMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith('Hello AI', 2, 'qa')
  })
})
