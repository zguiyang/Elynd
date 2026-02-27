<script setup lang="ts">
import { toast } from 'vue-sonner'
import { userApi, type UserConfig, type UpdateUserConfigData } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const user = computed(() => authStore.user)

interface ApiError {
  response?: {
    data?: {
      message?: string
    }
  }
}

const config = ref<UserConfig | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)

const formData = ref({
  fullName: '',
  nativeLanguage: 'zh',
  targetLanguage: 'en',
  vocabularyLevel: 'beginner',
  englishVariant: 'en-US',
  learningInitCompleted: false,
})

const vocabLevels = [
  { value: 'beginner', label: '初级 (Beginner)', description: '词汇量 < 2000' },
  { value: 'intermediate', label: '中级 (Intermediate)', description: '词汇量 2000-5000' },
  { value: 'advanced', label: '高级 (Advanced)', description: '词汇量 > 5000' },
]

const languages = [
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'ja', label: '日语 (Japanese)' },
  { value: 'ko', label: '韩语 (Korean)' },
  { value: 'fr', label: '法语 (French)' },
  { value: 'de', label: '德语 (German)' },
  { value: 'es', label: '西班牙语 (Spanish)' },
]

const targetLanguages = [
  { value: 'en', label: '英语 (English)' },
]

const englishVariants = [
  { value: 'en-US', label: '美式英语 (American)', description: 'KK 音标' },
  { value: 'en-GB', label: '英式英语 (British)', description: 'DJ 音标' },
]

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const fetchConfig = async () => {
  isLoading.value = true
  try {
    const response = await userApi.getConfig()
    config.value = response.data
    formData.value.nativeLanguage = response.data.nativeLanguage || 'zh'
    formData.value.targetLanguage = response.data.targetLanguage || 'en'
    formData.value.vocabularyLevel = response.data.vocabularyLevel || 'beginner'
    formData.value.englishVariant = response.data.englishVariant || 'en-US'
    formData.value.learningInitCompleted = response.data.learningInitCompleted
  } catch (error) {
    console.error('Failed to fetch config:', error)
  } finally {
    isLoading.value = false
  }
}

const handleSaveConfig = async () => {
  isSaving.value = true
  try {
    const data: UpdateUserConfigData = {
      nativeLanguage: formData.value.nativeLanguage,
      targetLanguage: formData.value.targetLanguage,
      vocabularyLevel: formData.value.vocabularyLevel,
      englishVariant: formData.value.englishVariant as 'en-US' | 'en-GB',
      learningInitCompleted: formData.value.learningInitCompleted,
    }
    await userApi.updateConfig(data)
    toast.success('设置已保存')
  } catch (error) {
    const apiError = error as ApiError
    const message = apiError.response?.data?.message || '保存设置失败'
    toast.error(message)
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  await authStore.fetchUser()
  if (user.value) {
    formData.value.fullName = user.value.fullName || ''
  }
  await fetchConfig()
})
</script>

<template>
  <div class="max-w-2xl mx-auto px-6 py-8 space-y-6">
    <header class="text-center space-y-4">
      <div class="inline-flex items-center justify-center">
        <img
          v-if="user?.avatar"
          :src="user.avatar"
          alt="Avatar"
          class="w-20 h-20 rounded-full object-cover ring-1 ring-border"
        />
        <div
          v-else
          class="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-2xl font-medium"
        >
          {{ user?.fullName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() }}
        </div>
      </div>
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">设置</h1>
        <p class="text-muted-foreground text-sm">管理您的账户和学习偏好</p>
      </div>
    </header>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <template v-else>
      <section class="bg-muted/30 rounded-lg p-6 space-y-4">
        <h2 class="text-base font-medium">个人资料</h2>
        <div class="divide-y">
          <div class="flex justify-between py-3">
            <span class="text-sm text-muted-foreground">用户名</span>
            <span class="text-sm font-medium">{{ user?.fullName || '-' }}</span>
          </div>
          <div class="flex justify-between py-3">
            <span class="text-sm text-muted-foreground">邮箱</span>
            <span class="text-sm font-medium">{{ user?.email }}</span>
          </div>
          <div class="flex justify-between py-3">
            <span class="text-sm text-muted-foreground">角色</span>
            <Badge :variant="user?.isAdmin ? 'default' : 'secondary'">
              {{ user?.isAdmin ? '管理员' : '普通用户' }}
            </Badge>
          </div>
          <div class="flex justify-between py-3">
            <span class="text-sm text-muted-foreground">注册时间</span>
            <span class="text-sm font-medium">{{ formatDate(user?.createdAt) }}</span>
          </div>
        </div>
      </section>

      <section class="bg-muted/30 rounded-lg p-6 space-y-5">
        <h2 class="text-base font-medium">学习设置</h2>
        
        <div class="space-y-4">
          <div class="space-y-1.5">
            <Label for="nativeLanguage" class="text-sm font-medium">母语</Label>
            <Select v-model="formData.nativeLanguage">
              <SelectTrigger id="nativeLanguage" class="h-10 w-full">
                <SelectValue placeholder="选择您的母语" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="lang in languages" :key="lang.value" :value="lang.value">
                  {{ lang.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">用于词典释义显示</p>
          </div>

          <div class="space-y-1.5">
            <Label for="targetLanguage" class="text-sm font-medium">目标语言</Label>
            <Select v-model="formData.targetLanguage">
              <SelectTrigger id="targetLanguage" class="h-10 w-full">
                <SelectValue placeholder="选择您要学习的语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="lang in targetLanguages" :key="lang.value" :value="lang.value">
                  {{ lang.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">当前仅支持英语</p>
          </div>

          <div class="space-y-1.5">
            <Label for="vocabularyLevel" class="text-sm font-medium">词汇水平</Label>
            <Select v-model="formData.vocabularyLevel">
              <SelectTrigger id="vocabularyLevel" class="h-10 w-full">
                <SelectValue placeholder="选择您的词汇水平" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="level in vocabLevels" :key="level.value" :value="level.value">
                  <div class="flex flex-col">
                    <span>{{ level.label }}</span>
                    <span class="text-xs text-muted-foreground">{{ level.description }}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">帮助我们为您推荐适合的文章难度</p>
          </div>

          <div class="space-y-1.5">
            <Label for="englishVariant" class="text-sm font-medium">英语变体</Label>
            <Select v-model="formData.englishVariant">
              <SelectTrigger id="englishVariant" class="h-10 w-full">
                <SelectValue placeholder="选择英语变体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="variant in englishVariants" :key="variant.value" :value="variant.value">
                  <div class="flex flex-col">
                    <span>{{ variant.label }}</span>
                    <span class="text-xs text-muted-foreground">{{ variant.description }}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">影响词汇表音标显示</p>
          </div>
        </div>

        <Button @click="handleSaveConfig" :disabled="isSaving" class="w-full h-10 mt-2">
          {{ isSaving ? '保存中...' : '保存设置' }}
        </Button>
      </section>

      <section class="bg-muted/30 rounded-lg p-6 space-y-4">
        <h2 class="text-base font-medium">账户安全</h2>
        <p class="text-sm text-muted-foreground">
          如需修改密码，请前往
          <router-link to="/learning/profile" class="text-primary hover:underline">
            个人资料页面
          </router-link>
        </p>
      </section>

      <section class="bg-muted/30 rounded-lg p-6 space-y-4">
        <h2 class="text-base font-medium">关于</h2>
        <div class="divide-y">
          <div class="flex justify-between py-3">
            <span class="text-sm text-muted-foreground">版本</span>
            <span class="text-sm font-medium">v0.1.0</span>
          </div>
          <div class="flex justify-between py-3">
            <span class="text-sm text-muted-foreground">产品</span>
            <span class="text-sm font-medium">Elynd - AI辅助英语阅读学习</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
