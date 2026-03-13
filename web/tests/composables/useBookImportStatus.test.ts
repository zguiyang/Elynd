import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useBookImportStatus, getStepText, getProgressComposition, getTaskSummary, canRetryVocabulary, canRetryAudio, STEP_KEYS, PROGRESS_WEIGHTS } from '@/composables/useBookImportStatus'

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

describe('Step text mapping', () => {
  it('returns "已接收" for import_received step', () => {
    expect(getStepText('import_received')).toBe('已接收')
  })

  it('returns "语义清洗" for semantic_cleaning step', () => {
    expect(getStepText('semantic_cleaning')).toBe('语义清洗')
  })

  it('returns "去重检查" for dedup_checking step', () => {
    expect(getStepText('dedup_checking')).toBe('去重检查')
  })

  it('returns "保存书籍" for persisting_book step', () => {
    expect(getStepText('persisting_book')).toBe('保存书籍')
  })

  it('returns "并行处理" for parallel_processing step', () => {
    expect(getStepText('parallel_processing')).toBe('并行处理')
  })

  it('returns "音频处理" for audio_processing step', () => {
    expect(getStepText('audio_processing')).toBe('音频处理')
  })

  it('returns "词汇处理" for vocabulary_processing step', () => {
    expect(getStepText('vocabulary_processing')).toBe('词汇处理')
  })

  it('returns "发布就绪" for finalizing_publish step', () => {
    expect(getStepText('finalizing_publish')).toBe('发布就绪')
  })

  it('returns "已完成" for completed step', () => {
    expect(getStepText('completed')).toBe('已完成')
  })

  it('returns "失败" for failed step', () => {
    expect(getStepText('failed')).toBe('失败')
  })

  it('falls back to step key for unknown steps', () => {
    expect(getStepText('unknown_step')).toBe('unknown_step')
  })
})

describe('Progress composition', () => {
  it('has correct progress weights defined', () => {
    expect(PROGRESS_WEIGHTS.PREP_PHASE_MAX).toBe(40)
    expect(PROGRESS_WEIGHTS.AUDIO_PHASE_MAX).toBe(30)
    expect(PROGRESS_WEIGHTS.VOCABULARY_PHASE_MAX).toBe(30)
    expect(PROGRESS_WEIGHTS.TOTAL_MAX).toBe(100)
  })

  it('calculates correct progress for prep phase', () => {
    const result = getProgressComposition({
      step: 'semantic_cleaning',
      stepProgress: 50, // 50% through prep phase
    })
    expect(result.totalProgress).toBe(20) // 40 * 0.5 = 20
    expect(result.phase).toBe('prep')
  })

  it('calculates correct progress for audio phase', () => {
    const result = getProgressComposition({
      step: 'audio_processing',
      stepProgress: 100, // 100% through audio phase
    })
    expect(result.totalProgress).toBe(70) // 40 + 30 * 1.0 = 70
    expect(result.phase).toBe('audio')
  })

  it('calculates correct progress for vocabulary phase', () => {
    const result = getProgressComposition({
      step: 'vocabulary_processing',
      stepProgress: 50, // 50% through vocabulary phase
    })
    expect(result.totalProgress).toBe(85) // 40 + 30 + 30 * 0.5 = 85
    expect(result.phase).toBe('vocabulary')
  })

  it('handles completed step correctly', () => {
    const result = getProgressComposition({
      step: 'completed',
      stepProgress: 100,
    })
    expect(result.totalProgress).toBe(100)
    expect(result.phase).toBe('complete')
  })

  it('handles failed step correctly', () => {
    const result = getProgressComposition({
      step: 'failed',
      stepProgress: 100,
    })
    expect(result.totalProgress).toBe(100)
    expect(result.phase).toBe('failed')
  })

  it('falls back to stepProgress for unknown steps', () => {
    const result = getProgressComposition({
      step: 'unknown_step',
      stepProgress: 75,
    })
    expect(result.totalProgress).toBe(75)
    expect(result.phase).toBe('prep')
  })
})

describe('STEP_KEYS exports', () => {
  it('exports all canonical step keys', () => {
    expect(STEP_KEYS.RECEIVED).toBe('import_received')
    expect(STEP_KEYS.SEMANTIC_CLEANING).toBe('semantic_cleaning')
    expect(STEP_KEYS.DEDUP_CHECKING).toBe('dedup_checking')
    expect(STEP_KEYS.PERSISTING_BOOK).toBe('persisting_book')
    expect(STEP_KEYS.PARALLEL_PROCESSING).toBe('parallel_processing')
    expect(STEP_KEYS.AUDIO_PROCESSING).toBe('audio_processing')
    expect(STEP_KEYS.VOCABULARY_PROCESSING).toBe('vocabulary_processing')
    expect(STEP_KEYS.FINALIZING_PUBLISH).toBe('finalizing_publish')
    expect(STEP_KEYS.COMPLETED).toBe('completed')
    expect(STEP_KEYS.FAILED).toBe('failed')
  })
})

// Step 1: Test dual task summaries (audio + vocabulary)
describe('Dual task summary', () => {
  it('exports getTaskSummary function', () => {
    // The composable should export a function that returns audio and vocabulary summary
    expect(typeof getTaskSummary).toBe('function')
  })

  it('returns audio summary in format completed/total', () => {
    const mockBook = {
      chapterAudioSummary: { total: 10, completed: 8, failed: 0, pending: 2 },
      vocabularySummary: undefined,
      audioStatus: 'processing',
      vocabularyStatus: undefined,
    }

    const result = getTaskSummary(mockBook as any)

    expect(result.audio).toBe('8/10')
  })

  it('returns vocabulary summary with completed/total when available', () => {
    const mockBook = {
      chapterAudioSummary: { total: 10, completed: 10, failed: 0, pending: 0 },
      vocabularySummary: { total: 100, completed: 50, failed: 0, pending: 50 },
      audioStatus: 'completed',
      vocabularyStatus: 'processing',
    }

    const result = getTaskSummary(mockBook as any)

    expect(result.vocabulary).toBe('50/100')
  })

  it('returns vocabulary batch summary when vocabularySummary is not available but vocabularyStatus exists', () => {
    const mockBook = {
      chapterAudioSummary: { total: 10, completed: 10, failed: 0, pending: 0 },
      vocabularySummary: undefined,
      audioStatus: 'completed',
      vocabularyStatus: 'processing',
    }

    const result = getTaskSummary(mockBook as any)

    // When vocabularySummary is not available, should return status text
    expect(result.vocabulary).toBeDefined()
  })

  it('returns both audio and vocabulary summaries', () => {
    const mockBook = {
      chapterAudioSummary: { total: 10, completed: 5, failed: 1, pending: 4 },
      vocabularySummary: { total: 100, completed: 30, failed: 2, pending: 68 },
      audioStatus: 'processing',
      vocabularyStatus: 'processing',
    }

    const result = getTaskSummary(mockBook as any)

    expect(result.audio).toBe('5/10')
    expect(result.vocabulary).toBe('30/100')
  })
})

// Step 4: Test retry button disabled logic
describe('Retry button disabled logic', () => {
  it('exports canRetryVocabulary function', () => {
    expect(typeof canRetryVocabulary).toBe('function')
  })

  it('exports canRetryAudio function', () => {
    expect(typeof canRetryAudio).toBe('function')
  })

  it('returns true for vocabulary retry when status is failed', () => {
    const mockBook = {
      vocabularyStatus: 'failed',
    }

    expect(canRetryVocabulary(mockBook as any)).toBe(true)
  })

  it('returns false for vocabulary retry when status is not failed', () => {
    const mockBook = {
      vocabularyStatus: 'processing',
    }

    expect(canRetryVocabulary(mockBook as any)).toBe(false)
  })

  it('returns false for vocabulary retry when status is pending', () => {
    const mockBook = {
      vocabularyStatus: 'pending',
    }

    expect(canRetryVocabulary(mockBook as any)).toBe(false)
  })

  it('returns false for vocabulary retry when status is completed', () => {
    const mockBook = {
      vocabularyStatus: 'completed',
    }

    expect(canRetryVocabulary(mockBook as any)).toBe(false)
  })

  it('returns true for audio retry when status is failed', () => {
    const mockBook = {
      audioStatus: 'failed',
    }

    expect(canRetryAudio(mockBook as any)).toBe(true)
  })

  it('returns false for audio retry when status is not failed', () => {
    const mockBook = {
      audioStatus: 'processing',
    }

    expect(canRetryAudio(mockBook as any)).toBe(false)
  })

  it('returns false for audio retry when status is completed', () => {
    const mockBook = {
      audioStatus: 'completed',
    }

    expect(canRetryAudio(mockBook as any)).toBe(false)
  })

  it('returns false for audio retry when status is pending', () => {
    const mockBook = {
      audioStatus: 'pending',
    }

    expect(canRetryAudio(mockBook as any)).toBe(false)
  })
})
