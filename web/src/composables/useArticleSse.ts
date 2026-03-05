import { transmit } from '@/lib/transmit'

import type { Article } from '@/types/article'

interface ArticleStatusEvent {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'

  progress?: number
  message?: string
  article?: Article
  error?: string
}

export function useArticleSse(userId: number) {
  const status = ref<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle')
  const article = ref<Article | null>(null)
  const error = ref<string | null>(null)

  let channel: ReturnType<typeof transmit.subscription> | null = null
  let unsubscribeFn: (() => void) | null = null

  async function subscribe() {
    transmit.on('connected', () => {})

    transmit.on('disconnected', () => {})

    transmit.on('reconnecting', () => {})

    channel = transmit.subscription(`user:${userId}:article`)

    await channel.create()

    unsubscribeFn = channel.onMessage((message: ArticleStatusEvent & { event?: string; data?: ArticleStatusEvent }) => {
      const event = message.data || message

      status.value = event.status

      if (event.status === 'completed' && event.article) {
        article.value = event.article
        error.value = null
      } else if (event.status === 'failed') {
        error.value = event.error || event.message || '文章生成失败'
        article.value = null
      } else if (event.status === 'queued' || event.status === 'processing') {
        error.value = null
      }
    })
  }

  function reset() {
    status.value = 'idle'
    article.value = null
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
    article,
    error,
    subscribe,
    unsubscribe,
    reset,
  }
}
