<script setup lang="ts">
import { Bot, Send } from 'lucide-vue-next'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'

const open = defineModel<boolean>('open', { default: false })

const messages = ref<{ role: 'user' | 'ai'; content: string }[]>([])
const inputValue = ref('')
const isLoading = ref(false)

const sendMessage = async () => {
  if (!inputValue.value.trim() || isLoading.value) return

  const content = inputValue.value
  messages.value.push({ role: 'user', content })
  inputValue.value = ''
  isLoading.value = true

  setTimeout(() => {
    messages.value.push({
      role: 'ai',
      content: '这是一个基于AI的回答。在实际实现中，这里将连接后端的AI问答API来获取回答。',
    })
    isLoading.value = false
  }, 1000)
}

const handleKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-[400px] sm:max-w-md flex flex-col p-0">
      <SheetHeader class="p-6 pb-0">
        <SheetTitle class="flex items-center gap-2">
          <Bot class="size-5" />
          AI 问答
        </SheetTitle>
      </SheetHeader>

      <div class="flex-1 flex flex-col min-h-0 p-6">
        <div class="flex-1 overflow-y-auto space-y-4 mb-4">
          <div v-if="messages.length === 0" class="text-center text-muted-foreground py-8">
            <Bot class="size-8 mx-auto mb-2 opacity-50" />
            <p class="text-sm">针对文章内容向 AI 提问</p>
          </div>
          <div
            v-for="(message, index) in messages"
            :key="index"
            :class="[
              'p-3 rounded-lg text-sm',
              message.role === 'user'
                ? 'bg-primary text-primary-foreground ml-8'
                : 'bg-muted mr-8',
            ]"
          >
            {{ message.content }}
          </div>
          <div v-if="isLoading" class="text-center text-muted-foreground">
            <Bot class="size-5 mx-auto animate-pulse" />
          </div>
        </div>

        <div class="space-y-2">
          <Textarea
            v-model="inputValue"
            placeholder="输入你的问题..."
            :disabled="isLoading"
            @keydown="handleKeydown"
          />
          <Button class="w-full" :disabled="isLoading || !inputValue.trim()" @click="sendMessage">
            <Send class="size-4 mr-2" />
            发送
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
