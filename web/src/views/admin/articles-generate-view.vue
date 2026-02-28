<script setup lang="ts">
import { toast } from 'vue-sonner'
import { adminApi, type GenerateArticleData } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { useArticleSse } from '@/composables/useArticleSse'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(false)
const difficultyLevel = ref<'L1' | 'L2' | 'L3'>('L2')
const topic = ref('')
const extraInstructions = ref('')

const topicError = ref('')
const extraInstructionsError = ref('')

const { status, error: sseError, subscribe, unsubscribe, reset } = useArticleSse(authStore.user!.id)
const progress = ref(0)
const statusMessage = ref('')

watch(status, (newStatus) => {
  console.log('[ArticlesGenerate] Watch 触发, newStatus:', newStatus, 'sseError:', sseError.value)
  if (newStatus === 'completed') {
    progress.value = 100
    statusMessage.value = '生成完成'
    toast.success('文章生成成功')
    setTimeout(() => {
      router.push('/learning/articles')
    }, 500)
  } else if (newStatus === 'failed') {
    progress.value = 0
    statusMessage.value = ''
    isLoading.value = false
    const errorMsg = sseError.value || '文章生成失败'
    console.log('[ArticlesGenerate] 显示失败 toast:', errorMsg)
    toast.error(errorMsg)
  } else if (newStatus === 'queued') {
    progress.value = 10
    statusMessage.value = '已加入生成队列...'
  } else if (newStatus === 'processing') {
    progress.value = 50
    statusMessage.value = '正在生成文章...'
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
    topicError.value = '请输入文章主题'
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
    const data: GenerateArticleData = {
      difficultyLevel: difficultyLevel.value,
      topic: topic.value.trim(),
    }

    if (extraInstructions.value.trim()) {
      data.extraInstructions = extraInstructions.value.trim()
    }

    await adminApi.generateArticle(data)
    // 等待 SSE 事件通知完成，不要立即跳转
  } catch (error) {
    const err = error as { message?: string }
    const message = err?.message || '生成失败，请稍后重试'
    toast.error(message)
    isLoading.value = false
  }
}
</script>

<template>
  <div class="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
    <Card>
      <CardHeader>
        <CardTitle>生成文章</CardTitle>
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
              placeholder="输入文章主题，如：职场沟通技巧"
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
            {{ isLoading || (status !== 'idle' && status !== 'failed') ? '生成中...' : '生成文章' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
