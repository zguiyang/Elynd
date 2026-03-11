import { ref, watch, onUnmounted } from 'vue'
import { adminApi } from '@/api/admin'
import { useBookImportSse } from './useBookImportSse'
import type { BookStatusResponse } from '@/types/book'
import { useAuthStore } from '@/stores/auth'

const FALLBACK_RETRY_DELAY_MS = 5000 // 5 seconds

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
