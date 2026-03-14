import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import BookImportView from '@/views/admin/book-import-view.vue'

vi.mock('@/api/admin', () => ({
  adminApi: {
    importBook: vi.fn(),
  },
}))

vi.mock('@/composables/useBookImportStatus', () => ({
  useBookImportStatus: () => ({
    status: null,
    startTracking: vi.fn(),
  }),
  getStepText: (key: string) => key,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

import { adminApi } from '@/api/admin'

function mountView() {
  return mount(BookImportView, {
    global: {
      stubs: {
        Card: defineComponent({ template: '<div><slot /></div>' }),
        CardHeader: defineComponent({ template: '<div><slot /></div>' }),
        CardTitle: defineComponent({ template: '<div><slot /></div>' }),
        CardContent: defineComponent({ template: '<div><slot /></div>' }),
        Alert: defineComponent({ template: '<div><slot /></div>' }),
        AlertTitle: defineComponent({ template: '<div><slot /></div>' }),
        AlertDescription: defineComponent({ template: '<div><slot /></div>' }),
        Label: defineComponent({ template: '<label><slot /></label>' }),
        Select: defineComponent({ template: '<div><slot /></div>' }),
        SelectTrigger: defineComponent({ template: '<div><slot /></div>' }),
        SelectValue: defineComponent({ template: '<div><slot /></div>' }),
        SelectContent: defineComponent({ template: '<div><slot /></div>' }),
        SelectItem: defineComponent({ template: '<div><slot /></div>' }),
        Button: defineComponent({
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        }),
        Progress: defineComponent({ template: '<div />' }),
      },
    },
  })
}

describe('book-import-view.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array(32).fill(1).buffer),
      },
    })
    vi.mocked(adminApi.importBook).mockResolvedValue({
      bookId: 1,
      status: 'processing',
      processingStep: 'import_received',
      processingProgress: 0,
    })
  })

  it('should not use parse endpoint flow anymore', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as any
    expect(typeof vm.parseSelectedFile).toBe('undefined')
  })

  it('should show success state after import request succeeds', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as any

    vm.selectedFile = {
      name: 'book.txt',
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('hello').buffer),
    } as unknown as File
    await vm.importNow()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('导入成功，任务已进入后台处理')
    expect(wrapper.text()).toContain('继续导入书籍')
    expect(wrapper.text()).toContain('查看进度')
  })
})
