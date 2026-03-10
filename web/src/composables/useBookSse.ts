import { transmit } from '@/lib/transmit'

import type { Book } from '@/types/book'

interface BookStatusEvent {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'

  progress?: number
  message?: string
  book?: Book
  error?: string
}

export function useBookSse(userId: number) {
  const status = ref<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle')
  const book = ref<Book | null>(null)
  const error = ref<string | null>(null)

  let channel: ReturnType<typeof transmit.subscription> | null = null
  let unsubscribeFn: (() => void) | null = null

  async function subscribe() {
    transmit.on('connected', () => {})

    transmit.on('disconnected', () => {})

    transmit.on('reconnecting', () => {})

    channel = transmit.subscription(`user:${userId}:book`)

    await channel.create()

    unsubscribeFn = channel.onMessage((message: BookStatusEvent & { event?: string; data?: BookStatusEvent }) => {
      const event = message.data || message

      status.value = event.status

      if (event.status === 'completed' && event.book) {
        book.value = event.book
        error.value = null
      } else if (event.status === 'failed') {
        error.value = event.error || event.message || '书籍生成失败'
        book.value = null
      } else if (event.status === 'queued' || event.status === 'processing') {
        error.value = null
      }
    })
  }

  function reset() {
    status.value = 'idle'
    book.value = null
    error.value = null
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

    reset()
  }

  onUnmounted(() => {
    unsubscribe()
  })

  return {
    status,
    book,
    error,
    subscribe,
    unsubscribe,
    reset,
  }
}
