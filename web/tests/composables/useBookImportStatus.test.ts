import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useBookImportStatus } from '@/composables/useBookImportStatus'

const mockUser = ref<{ id: number } | null>({ id: 42 })
const mockSseEvent = ref<any>(null)
const mockSseIsConnected = ref(false)
const mockTrackingBookId = ref<number | null>(null)
const mockSetTrackingBookId = vi.fn((bookId: number | null) => {
  mockTrackingBookId.value = bookId
})
const mockClearTracking = vi.fn(() => {
  mockTrackingBookId.value = null
  mockSseEvent.value = null
})
const mockSubscribeSse = vi.fn(async () => {})
const mockUnsubscribeSse = vi.fn(async () => {})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get user() {
      return mockUser.value
    },
  }),
}))

vi.mock('@/api/admin', () => ({
  adminApi: {
    getBookStatus: vi.fn(),
  },
}))

vi.mock('@/composables/useBookImportSse', () => ({
  useBookImportSse: () => ({
    event: mockSseEvent,
    isConnected: mockSseIsConnected,
    trackingBookId: mockTrackingBookId,
    setTrackingBookId: mockSetTrackingBookId,
    clearTracking: mockClearTracking,
    subscribe: mockSubscribeSse,
    unsubscribe: mockUnsubscribeSse,
  }),
}))

import { adminApi } from '@/api/admin'

function mountUseBookImportStatus() {
  const Harness = defineComponent({
    setup(_, { expose }) {
      const state = useBookImportStatus()
      expose(state)
      return () => null
    },
  })

  const wrapper = mount(Harness)
  return {
    wrapper,
    exposed: wrapper.vm as unknown as ReturnType<typeof useBookImportStatus>,
  }
}

describe('useBookImportStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockUser.value = { id: 42 }
    mockSseEvent.value = null
    mockSseIsConnected.value = false
    mockTrackingBookId.value = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('syncs SSE events into status and clears existing errors', async () => {
    const { exposed, wrapper } = mountUseBookImportStatus()

    exposed.error = 'previous error'
    mockSseEvent.value = {
      bookId: 99,
      status: 'processing',
      processingStep: 'parsing',
      processingProgress: 30,
      processingError: null,
    }

    await nextTick()

    expect(exposed.status).toEqual({
      id: 99,
      status: 'processing',
      processingStep: 'parsing',
      processingProgress: 30,
      processingError: null,
    })
    expect(exposed.error).toBe(null)
    expect(exposed.lastSyncAt).toBeInstanceOf(Date)

    wrapper.unmount()
  })

  it('refreshStatus updates status and lastSyncAt on success', async () => {
    vi.mocked(adminApi.getBookStatus).mockResolvedValue({
      id: 88,
      status: 'processing',
      processingStep: 'generating_audio',
      processingProgress: 70,
      processingError: null,
    } as any)

    mockTrackingBookId.value = 88

    const { exposed, wrapper } = mountUseBookImportStatus()

    await exposed.refreshStatus()

    expect(adminApi.getBookStatus).toHaveBeenCalledWith(88)
    expect(exposed.status?.id).toBe(88)
    expect(exposed.lastSyncAt).toBeInstanceOf(Date)
    expect(exposed.isLoading).toBe(false)

    wrapper.unmount()
  })

  it('refreshStatus stores a readable error on failure', async () => {
    vi.mocked(adminApi.getBookStatus).mockRejectedValue(new Error('status fetch failed'))

    mockTrackingBookId.value = 77

    const { exposed, wrapper } = mountUseBookImportStatus()

    await exposed.refreshStatus()

    expect(exposed.error).toBe('status fetch failed')
    expect(exposed.isLoading).toBe(false)

    wrapper.unmount()
  })

  it('schedules a fallback refresh when SSE disconnects with an active tracking book', async () => {
    vi.mocked(adminApi.getBookStatus).mockResolvedValue({
      id: 55,
      status: 'processing',
      processingStep: 'analyzing_vocabulary',
      processingProgress: 40,
      processingError: null,
    } as any)

    mockTrackingBookId.value = 55

    const { exposed, wrapper } = mountUseBookImportStatus()

    mockSseIsConnected.value = true
    await nextTick()

    mockSseIsConnected.value = false
    await nextTick()

    expect(exposed.error).toBe('SSE disconnected, fetching status...')

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(adminApi.getBookStatus).toHaveBeenCalledWith(55)

    wrapper.unmount()
  })

  it('startTracking sets the tracking id and subscribes to SSE', async () => {
    vi.mocked(adminApi.getBookStatus).mockResolvedValue({
      id: 66,
      status: 'processing',
      processingStep: 'parsing',
      processingProgress: 10,
      processingError: null,
    } as any)

    const { exposed, wrapper } = mountUseBookImportStatus()

    await exposed.startTracking(66)

    expect(mockSetTrackingBookId).toHaveBeenCalledWith(66)
    expect(mockSubscribeSse).toHaveBeenCalled()
    expect(adminApi.getBookStatus).toHaveBeenCalledWith(66)

    wrapper.unmount()
  })

  it('stopTracking unsubscribes and clears tracked state', async () => {
    const { exposed, wrapper } = mountUseBookImportStatus()

    exposed.status = {
      id: 10,
      status: 'processing',
      processingStep: 'parsing',
      processingProgress: 15,
      processingError: null,
    } as any
    exposed.lastSyncAt = new Date()
    mockTrackingBookId.value = 10

    await exposed.stopTracking()

    expect(mockUnsubscribeSse).toHaveBeenCalled()
    expect(mockClearTracking).toHaveBeenCalled()
    expect(exposed.status).toBe(null)
    expect(exposed.lastSyncAt).toBe(null)

    wrapper.unmount()
  })
})
