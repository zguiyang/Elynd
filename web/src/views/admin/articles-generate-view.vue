<script setup lang="ts">
import { toast } from 'vue-sonner'
import { adminApi, type GenerateArticleData } from '@/api/admin'

const router = useRouter()

const isLoading = ref(false)
const difficultyLevel = ref<'L1' | 'L2' | 'L3'>('L2')
const topic = ref('')
const extraInstructions = ref('')

const topicError = ref('')
const extraInstructionsError = ref('')

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
    toast.success('文章生成成功')
    await router.push('/learning/articles')
  } catch (error) {
    const err = error as { message?: string }
    const message = err?.message || '生成失败，请稍后重试'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="container max-w-2xl py-8">
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

          <Button type="submit" class="w-full" :disabled="isLoading">
            {{ isLoading ? '生成中...' : '生成文章' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
