import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BookImportView from '@/views/admin/book-import-view.vue'

vi.mock('@/api/admin', () => ({
  adminApi: {
    parseBookFile: vi.fn(),
    importBook: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

import { adminApi } from '@/api/admin'
import { toast } from 'vue-sonner'

const mockParseResult = {
  fileName: 'test-book.txt',
  title: 'Test Book',
  author: 'Test Author',
  description: 'A test book description',
  wordCount: 1000,
  chapters: [
    { chapterIndex: 0, title: 'Chapter 1', content: 'Content 1', wordCount: 500 },
    { chapterIndex: 1, title: 'Chapter 2', content: 'Content 2', wordCount: 500 },
  ],
}

const mockUser = { id: 42 }

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: mockUser,
  }),
}))

function mountBookImportView() {
  setActivePinia(createPinia())

  return mount(BookImportView, {
    global: {
      stubs: {
        Card: defineComponent({
          template: '<div><slot /></div>',
        }),
        CardHeader: defineComponent({
          template: '<div><slot /></div>',
        }),
        CardTitle: defineComponent({
          template: '<div><slot /></div>',
        }),
        CardContent: defineComponent({
          template: '<div><slot /></div>',
        }),
        Badge: defineComponent({
          props: ['variant'],
          template: '<span><slot /></span>',
        }),
        Alert: defineComponent({
          props: ['variant'],
          template: '<div v-if="$props.variant !== undefined"><slot /></div>',
        }),
        AlertTitle: defineComponent({
          template: '<div><slot /></div>',
        }),
        AlertDescription: defineComponent({
          template: '<div><slot /></div>',
        }),
        Label: defineComponent({
          template: '<label><slot /></label>',
        }),
        Input: defineComponent({
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        }),
        Textarea: defineComponent({
          props: ['modelValue', 'rows'],
          emits: ['update:modelValue'],
          template: '<textarea :value="modelValue" :rows="rows" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        }),
        Select: defineComponent({
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<div><slot /></div>',
        }),
        SelectTrigger: defineComponent({
          template: '<div><slot /></div>',
        }),
        SelectValue: defineComponent({
          template: '<span><slot /></span>',
        }),
        SelectContent: defineComponent({
          template: '<div><slot /></div>',
        }),
        SelectItem: defineComponent({
          props: ['value'],
          template: '<div><slot /></div>',
        }),
        Button: defineComponent({
          props: ['disabled', 'variant'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
        }),
        Upload: defineComponent({
          template: '<div><slot /></div>',
        }),
        FileText: defineComponent({
          template: '<div><slot /></div>',
        }),
        CheckCircle2: defineComponent({
          template: '<div><slot /></div>',
        }),
        Loader2: defineComponent({
          template: '<div><slot /></div>',
        }),
        AlertCircle: defineComponent({
          template: '<div><slot /></div>',
        }),
      },
    },
  })
}

describe('book-import-view.vue', () => {
  let wrapper: ReturnType<typeof mountBookImportView>
  let vm: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminApi.parseBookFile).mockResolvedValue(mockParseResult)
    vi.mocked(adminApi.importBook).mockResolvedValue({
      bookId: 1,
      status: 'processing',
      processingStep: 'import_received',
      processingProgress: 0,
    })

    wrapper = mountBookImportView()
    vm = wrapper.vm as any
  })

  describe('bookHash in import payload', () => {
    it('should include computed bookHash in import request payload', async () => {
      // Set up the component state directly to simulate a completed file parse
      vm.step = 2
      vm.preview = mockParseResult
      vm.form.title = 'Test Book'
      vm.form.author = 'Test Author'
      vm.form.description = 'Test description'
      vm.form.source = 'user_uploaded'
      vm.form.difficultyLevel = 'L1'
      vm.bookHash = 'abc123def456789012345678901234567890123456789012345678901234'

      // Call confirmImport
      await vm.confirmImport()

      await flushPromises()

      // Verify importBook was called with bookHash
      expect(adminApi.importBook).toHaveBeenCalled()
      const callArgs = vi.mocked(adminApi.importBook).mock.calls[0][0]

      // Assert bookHash is included in the payload
      expect(callArgs.bookHash).toBe('abc123def456789012345678901234567890123456789012345678901234')
    })

    it('should validate bookHash exists before import', async () => {
      // Set up state without hash
      vm.step = 2
      vm.bookHash = '' // Clear hash to simulate failure
      vm.preview = mockParseResult
      vm.form.title = 'Test Book'

      // Call confirmImport
      await vm.confirmImport()

      await flushPromises()

      // Should show error toast for missing hash
      expect(toast.error).toHaveBeenCalledWith('文件哈希计算失败')

      // importBook should not be called
      expect(adminApi.importBook).not.toHaveBeenCalled()
    })
  })

  describe('success messaging UX alignment', () => {
    it('should move to success step after import completes', async () => {
      // Set up the component state
      vm.step = 2
      vm.preview = mockParseResult
      vm.form.title = 'Test Book'
      vm.bookHash = 'abc123def456789012345678901234567890123456789012345678901234'

      // Call confirmImport
      await vm.confirmImport()

      await flushPromises()

      // Should move to step 3 (success step)
      expect(vm.step).toBe(3)
    })

    it('should display success message with link to task page', async () => {
      // Set up the component state to be in success state
      vm.step = 3
      await nextTick()
      await flushPromises()

      // Verify success message content in the template
      const successText = wrapper.text()
      expect(successText).toContain('已提交处理任务')
      expect(successText).toContain('后台正在异步处理')
      expect(successText).toContain('去往书籍任务页查看状态')
    })
  })
})
