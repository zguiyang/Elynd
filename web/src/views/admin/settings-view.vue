<script setup lang="ts">
import { toast } from 'vue-sonner'
import { adminApi, type SystemConfig } from '@/api/admin'
import { Eye, EyeOff, Loader2 } from 'lucide-vue-next'

const isLoading = ref(false)
const isSaving = ref(false)
const showApiKey = ref(false)

const formData = ref<SystemConfig>({
  aiBaseUrl: '',
  aiApiKey: '',
  aiModelName: 'gpt-4o-mini',
})

const formErrors = ref({
  aiBaseUrl: '',
  aiApiKey: '',
  aiModelName: '',
})

const loadConfig = async () => {
  isLoading.value = true
  try {
    const data = await adminApi.getSystemConfig()
    formData.value = {
      aiBaseUrl: data.aiBaseUrl || '',
      aiApiKey: data.aiApiKey || '',
      aiModelName: data.aiModelName || 'gpt-4o-mini',
    }
  } catch (error) {
    const err = error as { message?: string }
    const message = err?.message || '加载配置失败'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}

const validateForm = (): boolean => {
  formErrors.value = {
    aiBaseUrl: '',
    aiApiKey: '',
    aiModelName: '',
  }

  if (!formData.value.aiBaseUrl.trim()) {
    formErrors.value.aiBaseUrl = '请输入 API 基础 URL'
    return false
  }

  try {
    new URL(formData.value.aiBaseUrl)
  } catch {
    formErrors.value.aiBaseUrl = '请输入有效的 URL'
    return false
  }

  if (!formData.value.aiApiKey.trim()) {
    formErrors.value.aiApiKey = '请输入 API 密钥'
    return false
  }

  if (!formData.value.aiModelName.trim()) {
    formErrors.value.aiModelName = '请输入模型名称'
    return false
  }

  return true
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  isSaving.value = true
  try {
    await adminApi.updateSystemConfig({
      aiBaseUrl: formData.value.aiBaseUrl.trim(),
      aiApiKey: formData.value.aiApiKey.trim(),
      aiModelName: formData.value.aiModelName.trim(),
    })
    toast.success('配置保存成功')
  } catch (error) {
    const err = error as { message?: string }
    const message = err?.message || '保存配置失败，请稍后重试'
    toast.error(message)
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="container max-w-2xl py-8">
    <Card>
      <CardHeader>
        <CardTitle>AI 模型配置</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <form v-else @submit.prevent="handleSubmit" class="space-y-6">
          <div class="space-y-2">
            <Label for="aiBaseUrl" class="text-base">API 基础 URL</Label>
            <Input
              id="aiBaseUrl"
              v-model="formData.aiBaseUrl"
              placeholder="https://api.openai.com/v1"
              :disabled="isSaving"
              :class="{ 'border-destructive': formErrors.aiBaseUrl }"
            />
            <p v-if="formErrors.aiBaseUrl" class="text-sm text-destructive">
              {{ formErrors.aiBaseUrl }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="aiApiKey" class="text-base">API 密钥</Label>
            <div class="relative">
              <Input
                id="aiApiKey"
                v-model="formData.aiApiKey"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="sk-..."
                :disabled="isSaving"
                :class="{ 'border-destructive': formErrors.aiApiKey, 'pr-10': true }"
              />
              <button
                type="button"
                @click="showApiKey = !showApiKey"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                :disabled="isSaving"
              >
                <Eye v-if="showApiKey" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
            </div>
            <p v-if="formErrors.aiApiKey" class="text-sm text-destructive">
              {{ formErrors.aiApiKey }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="aiModelName" class="text-base">模型名称</Label>
            <Input
              id="aiModelName"
              v-model="formData.aiModelName"
              placeholder="gpt-4o-mini"
              :disabled="isSaving"
              :class="{ 'border-destructive': formErrors.aiModelName }"
            />
            <p v-if="formErrors.aiModelName" class="text-sm text-destructive">
              {{ formErrors.aiModelName }}
            </p>
          </div>

          <Button type="submit" class="w-full" :disabled="isSaving">
            <Loader2 v-if="isSaving" class="mr-2 h-4 w-4 animate-spin" />
            {{ isSaving ? '保存中...' : '保存配置' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
