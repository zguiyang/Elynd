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
    console.log('[SSE] 开始订阅, userId:', userId)

    transmit.on('connected', () => {
      console.log('[SSE] 已连接到SSE流')
    })

    transmit.on('disconnected', () => {
      console.log('[SSE] 断开连接')
    })

    transmit.on('reconnecting', () => {
      console.log('[SSE] 正在重连...')
    })

    channel = transmit.subscription(`user:${userId}:article`)
    console.log('[SSE] 频道创建, isCreated:', channel.isCreated)

    await channel.create()
    console.log('[SSE] 频道已创建, isCreated:', channel.isCreated)

    unsubscribeFn = channel.onMessage((message: ArticleStatusEvent & { event?: string; data?: ArticleStatusEvent }) => {
      console.log('[SSE] 收到原始消息:', message)

      const event = message.data || message
      console.log('[SSE] 解析后消息:', event)

      status.value = event.status

      if (event.status === 'completed' && event.article) {
        article.value = event.article
        error.value = null
        console.log('[SSE] 文章已更新:', article.value)
      } else if (event.status === 'failed') {
        error.value = event.error || event.message || '文章生成失败'
        article.value = null
        console.log('[SSE] 失败:', error.value)
      } else if (event.status === 'queued' || event.status === 'processing') {
        error.value = null
        console.log('[SSE] 状态:', event.status)
      }
    })
    console.log('[SSE] 消息监听器已注册, handlerCount:', channel.handlerCount)
  }

  async function unsubscribe() {
    console.log('[SSE] 开始取消订阅')
    if (unsubscribeFn) {
      unsubscribeFn()
      unsubscribeFn = null
    }

    if (channel) {
      await channel.delete()
      channel = null
    }

    status.value = 'idle'
    article.value = null
    error.value = null
    console.log('[SSE] 已取消订阅')
  }

  onUnmounted(() => {
    console.log('[SSE] 组件卸载')
    unsubscribe()
  })

  return {
    status,
    article,
    error,
    subscribe,
    unsubscribe,
  }
}
