<script setup lang="ts">
import { Send, Loader2, Bot, User } from 'lucide-vue-next'

interface Props {
  open: boolean
  articleId: number
  articleTitle: string
  chapterContent?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isLoading?: boolean
}

const messages = ref<Message[]>([])
const inputMessage = ref('')
const isLoading = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const sendMessage = async () => {
  const message = inputMessage.value.trim()
  if (!message || isLoading.value) return

  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: message,
  }
  messages.value.push(userMessage)
  inputMessage.value = ''

  const assistantMessage: Message = {
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: '',
    isLoading: true,
  }
  messages.value.push(assistantMessage)
  isLoading.value = true
  scrollToBottom()

  try {
    const response = await fetch(`/api/articles/${props.articleId}/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        articleTitle: props.articleTitle,
        chapterContent: props.chapterContent,
      }),
    })

    if (!response.ok) {
      throw new Error('请求失败')
    }

    const data = await response.json()
    assistantMessage.content = data.response
    assistantMessage.isLoading = false
  } catch {
    assistantMessage.content = '抱歉，请稍后重试'
    assistantMessage.isLoading = false
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="right" class="w-full sm:w-[480px] p-0 flex flex-col">
      <SheetHeader class="px-4 py-3 border-b shrink-0">
        <div class="flex items-center justify-between">
          <SheetTitle class="flex items-center gap-2">
            <Bot class="size-5" />
            AI 问答
          </SheetTitle>
          <SheetClose class="size-8" />
        </div>
        <SheetDescription class="text-xs">
          关于 "{{ articleTitle }}" 的问题
        </SheetDescription>
      </SheetHeader>

      <div ref="messagesContainer" class="flex-1 overflow-auto p-4 space-y-4">
        <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <Bot class="size-12 mb-3 opacity-50" />
          <p class="text-sm">有什么可以帮助您的？</p>
          <p class="text-xs mt-1">可以关于文章内容提问</p>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex gap-3"
          :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
        >
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-full"
            :class="msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'"
          >
            <User v-if="msg.role === 'user'" class="size-4" />
            <Bot v-else class="size-4" />
          </div>
          <div
            class="max-w-[80%] rounded-lg px-3 py-2 text-sm"
            :class="msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'"
          >
            <div v-if="msg.isLoading" class="flex items-center gap-1">
              <span class="size-1.5 rounded-full bg-current animate-bounce" style="animation-delay: 0ms" />
              <span class="size-1.5 rounded-full bg-current animate-bounce" style="animation-delay: 150ms" />
              <span class="size-1.5 rounded-full bg-current animate-bounce" style="animation-delay: 300ms" />
            </div>
            <p v-else class="whitespace-pre-wrap">{{ msg.content }}</p>
          </div>
        </div>
      </div>

      <div class="p-4 border-t shrink-0">
        <div class="flex gap-2">
          <Textarea
            v-model="inputMessage"
            placeholder="输入问题..."
            class="min-h-10 max-h-32 resize-none"
            :disabled="isLoading"
            @keydown="handleKeydown"
          />
          <Button size="icon" class="shrink-0" :disabled="isLoading || !inputMessage.trim()" @click="sendMessage">
            <Loader2 v-if="isLoading" class="size-4 animate-spin" />
            <Send v-else class="size-4" />
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
