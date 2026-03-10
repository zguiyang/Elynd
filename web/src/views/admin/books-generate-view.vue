<script setup lang="ts">
import { toast } from 'vue-sonner'
import { CheckCircle2, FileText, Clock, Calendar } from 'lucide-vue-next'
import { adminApi, type GenerateBookData } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { useBookSse } from '@/composables/useBookSse'

const router = useRouter()
const authStore = useAuthStore()

if (!authStore.user) {
  toast.error('用户信息加载失败')
  throw new Error('User not loaded')
}

const isLoading = ref(false)
const difficultyLevel = ref<'L1' | 'L2' | 'L3'>('L1')
const topic = ref('')
const extraInstructions = ref('')

const topicError = ref('')
const extraInstructionsError = ref('')

const { status, book, error: sseError, subscribe, unsubscribe, reset } = useBookSse(authStore.user.id)
const progress = ref(0)
const statusMessage = ref('')

watch(status, (newStatus) => {
  if (newStatus === 'completed') {
    progress.value = 100
    statusMessage.value = '生成完成'
  } else if (newStatus === 'failed') {
    progress.value = 0
    statusMessage.value = ''
    isLoading.value = false
    const errorMsg = sseError.value || '书籍生成失败'
    toast.error(errorMsg)
  } else if (newStatus === 'queued') {
    progress.value = 10
    statusMessage.value = '已加入生成队列...'
  } else if (newStatus === 'processing') {
    progress.value = 50
    statusMessage.value = '正在生成书籍...'
  }
})

onMounted(() => subscribe())
onUnmounted(() => unsubscribe())

const difficulties = [
  { value: 'L1', label: 'L1 - 初级' },
  { value: 'L2', label: 'L2 - 中级' },
  { value: 'L3', label: 'L3 - 高级' },
]

const validateForm = (): boolean => {
  topicError.value = ''
  extraInstructionsError.value = ''

  if (!topic.value.trim()) {
    topicError.value = '请输入书籍主题'
    return false
  }

  if (topic.value.trim().length < 5) {
    topicError.value = '主题至少需要5个字符'
    return false
  }

  if (topic.value.trim().length > 200) {
    topicError.value = '主题不能超过200个字符'
    return false
  }

  if (extraInstructions.value.length > 500) {
    extraInstructionsError.value = '额外指令不能超过500个字符'
    return false
  }

  return true
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  reset()
  isLoading.value = true

  try {
    const data: GenerateBookData = {
      difficultyLevel: difficultyLevel.value,
      topic: topic.value.trim(),
    }

    if (extraInstructions.value.trim()) {
      data.extraInstructions = extraInstructions.value.trim()
    }

    await adminApi.generateBook(data)
    // 等待 SSE 事件通知完成，不要立即跳转
  } catch (error) {
    const err = error as { message?: string }
    const message = err?.message || '生成失败，请稍后重试'
    toast.error(message)
    isLoading.value = false
  }
}

const handleContinue = () => {
  reset()
  difficultyLevel.value = 'L1'
  topic.value = ''
  extraInstructions.value = ''
  progress.value = 0
  statusMessage.value = ''
  isLoading.value = false
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<template>
  <div class="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
    <!-- 成功卡片 -->
    <Card v-if="status === 'completed' && book" class="overflow-hidden">
      <CardHeader class="text-center pb-4">
        <div class="flex justify-center mb-4">
          <CheckCircle2 class="w-16 h-16 text-success" />
        </div>
        <CardTitle class="text-2xl">书籍生成成功</CardTitle>
      </CardHeader>

      <CardContent class="space-y-6">
        <!-- 书籍标题 -->
        <div class="text-center">
          <h3
            class="text-lg font-semibold cursor-pointer hover:text-primary transition-colors duration-150"
            @click="router.push(`/learning/book/${book.id}`)"
          >
            {{ book.title }}
          </h3>
        </div>

        <!-- 元信息 -->
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="flex items-center gap-2 text-muted-foreground">
            <span>难度等级:</span>
            <Badge>{{ book.difficultyLevel }}</Badge>
          </div>
          <div class="flex items-center gap-2 text-muted-foreground">
            <FileText class="w-4 h-4" />
            <span>{{ book.wordCount }} 字</span>
          </div>
          <div class="flex items-center gap-2 text-muted-foreground">
            <Clock class="w-4 h-4" />
            <span>{{ book.readingTime }} 分钟</span>
          </div>
          <div class="flex items-center gap-2 text-muted-foreground">
            <Calendar class="w-4 h-4" />
            <span>{{ formatDate(book.createdAt) }}</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-3 pt-2">
          <Button class="flex-1" @click="handleContinue">
            继续生成
          </Button>
          <Button
            variant="secondary"
            class="flex-1"
            @click="router.push(`/learning/book/${book.id}`)"
          >
            查看书籍
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 表单 -->
    <Card v-else>
      <CardHeader>
        <CardTitle>生成书籍</CardTitle>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <div class="space-y-3">
            <Label class="text-base">难度等级</Label>
            <div class="flex gap-6">
              <label
                v-for="diff in difficulties"
                :key="diff.value"
                class="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  :value="diff.value"
                  v-model="difficultyLevel"
                  class="w-4 h-4 text-primary"
                  :disabled="isLoading"
                />
                <span class="text-sm">{{ diff.label }}</span>
              </label>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="topic" class="text-base">主题 / 话题</Label>
            <Input
              id="topic"
              v-model="topic"
              placeholder="输入书籍主题，如：职场沟通技巧"
              :disabled="isLoading"
              :class="{ 'border-destructive': topicError }"
            />
            <p v-if="topicError" class="text-sm text-destructive">{{ topicError }}</p>
          </div>

          <div class="space-y-2">
            <Label for="extraInstructions" class="text-base">额外指令（可选）</Label>
            <Textarea
              id="extraInstructions"
              v-model="extraInstructions"
              placeholder="补充要求，如：包含具体案例、使用对话形式..."
              :disabled="isLoading"
              :class="{ 'border-destructive': extraInstructionsError }"
              :rows="4"
            />
            <p v-if="extraInstructionsError" class="text-sm text-destructive">
              {{ extraInstructionsError }}
            </p>
            <p class="text-xs text-muted-foreground text-right">
              {{ extraInstructions.length }}/500
            </p>
          </div>

          <div v-if="status !== 'idle' && status !== 'completed' && status !== 'failed'" class="space-y-2">
            <Progress :model-value="progress" />
            <p class="text-sm text-muted-foreground text-center">{{ statusMessage }}</p>
          </div>

          <div v-if="status === 'failed' && sseError" class="space-y-2">
            <Alert variant="destructive">
              <AlertTitle>生成失败</AlertTitle>
              <AlertDescription class="text-sm">{{ sseError }}</AlertDescription>
            </Alert>
          </div>

          <Button
            type="submit"
            class="w-full"
            :disabled="isLoading || (status !== 'idle' && status !== 'failed')"
          >
            {{ isLoading || (status !== 'idle' && status !== 'failed') ? '生成中...' : '生成书籍' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
