import { ref, watch, onUnmounted } from 'vue'
import { adminApi } from '@/api/admin'
import { useBookImportSse } from './useBookImportSse'
import type { BookStatusResponse } from '@/types/book'
import { useAuthStore } from '@/stores/auth'

const FALLBACK_RETRY_DELAY_MS = 5000 // 5 seconds

// Canonical step keys for import pipeline
export const STEP_KEYS = {
  RECEIVED: 'import_received',
  FILE_VALIDATING: 'file_validating',
  SEMANTIC_METADATA: 'semantic_metadata',
  SEMANTIC_CHAPTERS: 'semantic_chapters',
  CONTENT_HASHING: 'content_hashing',
  VOCABULARY_EXTRACTING: 'vocabulary_extracting',
  PARALLEL_PROCESSING: 'parallel_processing',
  FINALIZING_PUBLISH: 'finalizing_publish',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const

// Progress weight constants
export const PROGRESS_WEIGHTS = {
  IMPORT_RECEIVED: 5,
  FILE_VALIDATING: 5,
  SEMANTIC_METADATA: 15,
  SEMANTIC_CHAPTERS: 20,
  CONTENT_HASHING: 5,
  VOCABULARY_EXTRACTING: 15,
  PARALLEL_PROCESSING: 30,
  FINALIZING_PUBLISH: 5,
  TOTAL_MAX: 100
} as const

// Step key to Chinese text mapping
export function getStepText(stepKey: string): string {
  const stepTextMap: Record<string, string> = {
    [STEP_KEYS.RECEIVED]: '已接收',
    [STEP_KEYS.FILE_VALIDATING]: '校验文件',
    [STEP_KEYS.SEMANTIC_METADATA]: '提取书籍信息',
    [STEP_KEYS.SEMANTIC_CHAPTERS]: '清洗章节',
    [STEP_KEYS.CONTENT_HASHING]: '计算内容哈希',
    [STEP_KEYS.VOCABULARY_EXTRACTING]: '提取词汇',
    [STEP_KEYS.PARALLEL_PROCESSING]: '并行处理',
    [STEP_KEYS.FINALIZING_PUBLISH]: '发布书籍',
    [STEP_KEYS.COMPLETED]: '已完成',
    [STEP_KEYS.FAILED]: '失败',
    // Legacy step keys for backwards compatibility
    'parsing': '解析书籍',
    'analyze_vocabulary': '分析词汇',
    'analyzing_vocabulary': '分析词汇',
    'generate_meanings': '生成释义',
    'generating_meanings': '生成释义',
    'queue_audio': '队列音频',
    'generate_audio': '生成音频',
    'audio_queued': '音频已队列',
    'audio_failed': '音频失败',
    'audio_completed_waiting_vocabulary': '等待词汇处理完成',
  }
  return stepTextMap[stepKey] || stepKey
}

// Progress composition calculation
export interface ProgressCompositionResult {
  totalProgress: number
  phase: 'prep' | 'audio' | 'vocabulary' | 'complete' | 'failed'
  phaseProgress: number
}

export function getProgressComposition(params: {
  step: string
  stepProgress: number
}): ProgressCompositionResult {
  const { step, stepProgress } = params

  // Map step keys to phases
  const schedulerSteps: string[] = [
    STEP_KEYS.RECEIVED,
    STEP_KEYS.FILE_VALIDATING,
    STEP_KEYS.SEMANTIC_METADATA,
    STEP_KEYS.SEMANTIC_CHAPTERS,
    STEP_KEYS.CONTENT_HASHING,
    STEP_KEYS.VOCABULARY_EXTRACTING,
    STEP_KEYS.PARALLEL_PROCESSING,
    STEP_KEYS.FINALIZING_PUBLISH
  ]
  const completeSteps: string[] = [STEP_KEYS.COMPLETED]
  const failedSteps: string[] = [STEP_KEYS.FAILED]

  const legacySteps = [
    'parsing',
    'analyze_vocabulary',
    'analyzing_vocabulary',
    'generate_meanings',
    'generating_meanings',
    'queue_audio',
    'generate_audio',
    'audio_queued',
    'audio_failed',
    'generating_vocabulary'
  ]

  if (completeSteps.includes(step) || step === 'completed') {
    return { totalProgress: 100, phase: 'complete', phaseProgress: 100 }
  }

  if (failedSteps.includes(step) || step === 'failed') {
    return { totalProgress: 100, phase: 'failed', phaseProgress: 100 }
  }

  if (schedulerSteps.includes(step)) {
    return { totalProgress: stepProgress, phase: 'prep', phaseProgress: stepProgress }
  }

  if (legacySteps.includes(step)) {
    return { totalProgress: stepProgress, phase: 'prep', phaseProgress: stepProgress }
  }

  // Default fallback
  return { totalProgress: stepProgress, phase: 'prep', phaseProgress: stepProgress }
}

// Step 2 & 3: Unified mapping for dual task summaries (audio + vocabulary)
export interface TaskSummary {
  audio: string | null
  vocabulary: string | null
}

// Get task summary for display: audio completed/total and vocabulary completed/total or status text
export function getTaskSummary(book: {
  chapterAudioSummary?: {
    total: number
    completed: number
    failed?: number
    pending?: number
  }
  vocabularySummary?: {
    total: number
    completed: number
    failed?: number
    pending?: number
  } | null
  audioStatus?: string | null
  vocabularyStatus?: string | null
}): TaskSummary {
  const audioSummary = book.chapterAudioSummary
  const vocabSummary = book.vocabularySummary

  // Audio summary: always show completed/total if available
  let audio: string | null = null
  if (audioSummary && audioSummary.total > 0) {
    audio = `${audioSummary.completed}/${audioSummary.total}`
  }

  // Vocabulary summary: show completed/total if vocabularySummary exists, otherwise show status text
  let vocabulary: string | null = null
  if (vocabSummary && vocabSummary.total > 0) {
    vocabulary = `${vocabSummary.completed}/${vocabSummary.total}`
  } else if (book.vocabularyStatus) {
    // Fallback to status text when summary is not available
    const statusTextMap: Record<string, string> = {
      pending: '待处理',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
    }
    vocabulary = statusTextMap[book.vocabularyStatus] || book.vocabularyStatus
  }

  return { audio, vocabulary }
}

// Step 4: Retry button disabled logic
export function canRetryVocabulary(book: {
  vocabularyStatus?: string | null
}): boolean {
  return book.vocabularyStatus === 'failed'
}

export function canRetryAudio(book: {
  audioStatus?: string | null
}): boolean {
  return book.audioStatus === 'failed'
}

export function useBookImportStatus() {
  const authStore = useAuthStore()
  const userId = authStore.user?.id

  if (!userId) {
    throw new Error('User not found')
  }

  const status = ref<BookStatusResponse | null>(null)
  const isConnected = ref(false)
  const lastSyncAt = ref<Date | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let fallbackTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 3

  const {
    event: sseEvent,
    isConnected: sseIsConnected,
    trackingBookId,
    setTrackingBookId,
    clearTracking,
    subscribe: subscribeSse,
    unsubscribe: unsubscribeSse,
  } = useBookImportSse(userId)

  // Sync SSE connection state
  watch(sseIsConnected, (connected) => {
    isConnected.value = connected
    if (connected) {
      reconnectAttempts = 0
      clearFallbackTimer()
    } else if (trackingBookId.value && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      // SSE disconnected but we have a tracking book - schedule fallback
      scheduleFallback()
    }
  })

  // Sync SSE events to status
  watch(sseEvent, (event) => {
    if (event) {
      status.value = {
        id: event.bookId,
        status: event.status,
        processingStep: event.processingStep,
        processingProgress: event.processingProgress,
        processingError: event.processingError ?? null,
      }
      lastSyncAt.value = new Date()
      error.value = null
    }
  })

  function scheduleFallback() {
    if (fallbackTimer) {
      return
    }

    reconnectAttempts++
    error.value = 'SSE disconnected, fetching status...'

    fallbackTimer = setTimeout(async () => {
      fallbackTimer = null
      if (trackingBookId.value) {
        await refreshStatus()
      }
    }, FALLBACK_RETRY_DELAY_MS)
  }

  function clearFallbackTimer() {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
  }

  async function refreshStatus() {
    const bookId = trackingBookId.value
    if (!bookId) {
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await adminApi.getBookStatus(bookId)
      status.value = response
      lastSyncAt.value = new Date()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch status'
    } finally {
      isLoading.value = false
    }
  }

  async function startTracking(bookId: number) {
    setTrackingBookId(bookId)
    await subscribeSse()

    // Initial status fetch via API if SSE might be stale
    if (!sseIsConnected.value) {
      await refreshStatus()
    }
  }

  async function stopTracking() {
    clearFallbackTimer()
    await unsubscribeSse()
    clearTracking()
    status.value = null
    lastSyncAt.value = null
  }

  onUnmounted(() => {
    clearFallbackTimer()
  })

  return {
    status,
    isConnected,
    lastSyncAt,
    isLoading,
    error,
    trackingBookId,
    refreshStatus,
    startTracking,
    stopTracking,
  }
}
