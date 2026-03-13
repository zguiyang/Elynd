import { describe, it, expect, vi } from 'vitest'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 1 },
  }),
}))

vi.mock('@/api/admin', () => ({
  adminApi: {
    getBookStatus: vi.fn(),
  },
}))

vi.mock('@/composables/useBookImportSse', () => ({
  useBookImportSse: () => ({
    event: { value: null },
    isConnected: { value: false },
    trackingBookId: { value: null },
    setTrackingBookId: vi.fn(),
    clearTracking: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}))

const mod = await import('@/composables/useBookImportStatus')
const { STEP_KEYS, PROGRESS_WEIGHTS, getStepText, getProgressComposition } = mod

describe('useBookImportStatus step mapping', () => {
  it('contains canonical scheduler step keys', () => {
    expect(STEP_KEYS.RECEIVED).toBe('import_received')
    expect(STEP_KEYS.FILE_VALIDATING).toBe('file_validating')
    expect(STEP_KEYS.SEMANTIC_METADATA).toBe('semantic_metadata')
    expect(STEP_KEYS.SEMANTIC_CHAPTERS).toBe('semantic_chapters')
    expect(STEP_KEYS.CONTENT_HASHING).toBe('content_hashing')
    expect(STEP_KEYS.VOCABULARY_EXTRACTING).toBe('vocabulary_extracting')
    expect(STEP_KEYS.PARALLEL_PROCESSING).toBe('parallel_processing')
    expect(STEP_KEYS.FINALIZING_PUBLISH).toBe('finalizing_publish')
    expect(STEP_KEYS.COMPLETED).toBe('completed')
    expect(STEP_KEYS.FAILED).toBe('failed')
  })

  it('contains deterministic progress weights', () => {
    expect(PROGRESS_WEIGHTS.IMPORT_RECEIVED).toBe(5)
    expect(PROGRESS_WEIGHTS.FILE_VALIDATING).toBe(5)
    expect(PROGRESS_WEIGHTS.SEMANTIC_METADATA).toBe(15)
    expect(PROGRESS_WEIGHTS.SEMANTIC_CHAPTERS).toBe(20)
    expect(PROGRESS_WEIGHTS.CONTENT_HASHING).toBe(5)
    expect(PROGRESS_WEIGHTS.VOCABULARY_EXTRACTING).toBe(15)
    expect(PROGRESS_WEIGHTS.PARALLEL_PROCESSING).toBe(30)
    expect(PROGRESS_WEIGHTS.FINALIZING_PUBLISH).toBe(5)
    expect(PROGRESS_WEIGHTS.TOTAL_MAX).toBe(100)
  })

  it('maps new scheduler steps to readable Chinese text', () => {
    expect(getStepText('file_validating')).toBe('校验文件')
    expect(getStepText('semantic_metadata')).toBe('提取书籍信息')
    expect(getStepText('semantic_chapters')).toBe('清洗章节')
    expect(getStepText('content_hashing')).toBe('计算内容哈希')
    expect(getStepText('vocabulary_extracting')).toBe('提取词汇')
    expect(getStepText('finalizing_publish')).toBe('发布书籍')
  })

  it('uses scheduler progress as source of truth', () => {
    const result = getProgressComposition({
      step: 'parallel_processing',
      stepProgress: 77,
    })
    expect(result.totalProgress).toBe(77)
    expect(result.phase).toBe('prep')
  })
})
