import { transmit } from '@/lib/transmit'

export interface BookImportStatusEvent {
  bookId: number
  status: 'processing' | 'ready' | 'failed'
  processingStep: string
  processingProgress: number
  message: string
  processingError?: string | null
}

const STORAGE_KEY = 'book-import-tracking-id'

export function useBookImportSse(userId: number) {
  const event = ref<BookImportStatusEvent | null>(null)
  const isConnected = ref(false)
  const error = ref<string | null>(null)
  const trackingBookId = ref<number | null>(restoreTrackingBookId())

  let channel: ReturnType<typeof transmit.subscription> | null = null
  let unsubscribeFn: (() => void) | null = null

  function restoreTrackingBookId() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }

    const parsed = Number(stored)
    return Number.isFinite(parsed) ? parsed : null
  }

  function setTrackingBookId(bookId: number | null) {
    trackingBookId.value = bookId

    if (bookId === null) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }

    localStorage.setItem(STORAGE_KEY, String(bookId))
  }

  async function subscribe() {
    if (channel) {
      return
    }

    channel = transmit.subscription(`user:${userId}:book_import`)
    await channel.create()
    isConnected.value = true
    error.value = null

    unsubscribeFn = channel.onMessage((message: BookImportStatusEvent & { data?: BookImportStatusEvent }) => {
      const payload = message.data || message
      event.value = payload
      setTrackingBookId(payload.bookId)
    })
  }

  async function unsubscribe() {
    if (unsubscribeFn) {
      unsubscribeFn()
      unsubscribeFn = null
    }

    if (channel) {
      await channel.delete()
      channel = null
    }

    isConnected.value = false
  }

  function clearTracking() {
    setTrackingBookId(null)
    event.value = null
  }

  onUnmounted(() => {
    unsubscribe()
  })

  return {
    event,
    error,
    isConnected,
    trackingBookId,
    setTrackingBookId,
    clearTracking,
    subscribe,
    unsubscribe,
  }
}
