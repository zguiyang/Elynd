<script setup lang="ts">
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-vue-next'
import { useBookChat } from '@/composables/useBookChat'
import MarkdownRenderer from './MarkdownRenderer.vue'

interface Props {
  open: boolean
  bookId: number
  bookTitle: string
  chapterContent?: string
  chapterIndex?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const inputMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

const { messages, isLoading, isWaitingForResponse, sendMessage, clearMessages } = useBookChat(
  computed(() => props.bookId)
)

const quickActions = [
  { label: '解释', prompt: '请解释这本书的主要内容' },
  { label: '翻译', prompt: '请翻译这段书籍内容' },
  { label: '总结', prompt: '请总结这本书的重点' },
]

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      clearMessages()
    }
  }
)

watch(
  () => props.bookId,
  () => {
    clearMessages()
  }
)

watch(
  () => messages.value,
  () => {
    scrollToBottom()
  },
  { deep: true }
)

const sendMessageHandler = () => {
  const message = inputMessage.value.trim()
  if (!message || isLoading.value) return

  sendMessage(message, props.chapterIndex)
  inputMessage.value = ''
  scrollToBottom()
}

const fillInput = (prompt: string) => {
  inputMessage.value = prompt
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessageHandler()
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="right" class="w-[85%] sm:w-[60%] lg:w-[50%] p-0 flex flex-col" style="max-width: 700px">
      <SheetHeader class="px-4 py-3 border-b shrink-0">
        <div class="flex items-center justify-between">
          <SheetTitle class="flex items-center gap-2">
            <Bot class="size-5" />
            AI 问答
          </SheetTitle>
          <SheetClose class="size-8" />
        </div>
        <SheetDescription class="text-xs">
          关于 "{{ bookTitle }}" 的问题
        </SheetDescription>
      </SheetHeader>

      <div ref="messagesContainer" class="flex-1 overflow-auto p-4 space-y-4">
        <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <Bot class="size-12 mb-3 opacity-50" />
          <p class="text-sm">有什么可以帮助您的？</p>
          <p class="text-xs mt-1">可以关于书籍内容提问</p>

          <div class="flex flex-wrap gap-2 mt-4 justify-center">
            <Button
              v-for="action in quickActions"
              :key="action.label"
              variant="outline"
              size="sm"
              class="text-xs"
              @click="fillInput(action.prompt)"
            >
              <Sparkles class="size-3 mr-1" />
              {{ action.label }}
            </Button>
          </div>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="index"
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
            <!-- User Message - Plain Text -->
            <p v-if="msg.role === 'user'" class="whitespace-pre-wrap">{{ msg.content }}</p>
            
            <!-- Assistant Message -->
            <template v-else>
              <!-- Waiting State - Show Skeleton -->
              <div v-if="isWaitingForResponse && index === messages.length - 1 && !msg.content" class="space-y-2 w-48">
                <Skeleton class="h-3 w-full" />
                <Skeleton class="h-3 w-4/5" />
                <Skeleton class="h-3 w-3/5" />
              </div>
              
              <!-- Streaming/Typing State - Show Markdown with Typewriter -->
              <MarkdownRenderer
                v-else-if="isLoading && index === messages.length - 1"
                :content="msg.content"
                :is-streaming="true"
              />
              
              <!-- Completed State - Show Markdown -->
              <MarkdownRenderer
                v-else
                :content="msg.content"
                :is-streaming="false"
              />
            </template>
          </div>
        </div>
      </div>

      <div class="p-4 border-t shrink-0">
        <div v-if="messages.length > 0" class="flex flex-wrap gap-2 mb-2">
          <Button
            v-for="action in quickActions"
            :key="action.label"
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :disabled="isLoading"
            @click="fillInput(action.prompt)"
          >
            <Sparkles class="size-3 mr-1" />
            {{ action.label }}
          </Button>
        </div>
        <div class="flex gap-2">
          <Textarea
            v-model="inputMessage"
            placeholder="输入问题..."
            class="min-h-10 max-h-32 resize-none"
            :disabled="isLoading"
            @keydown="handleKeydown"
          />
          <Button size="icon" class="shrink-0" :disabled="isLoading || !inputMessage.trim()" @click="sendMessageHandler">
            <Loader2 v-if="isLoading" class="size-4 animate-spin" />
            <Send v-else class="size-4" />
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
