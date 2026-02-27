<script setup lang="ts">
import { toast } from 'vue-sonner'
import { userApi } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const user = computed(() => authStore.user)

const isLoading = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')

interface ApiError {
  response?: {
    data?: {
      message?: string
    }
  }
}

const handlePasswordChange = async () => {
  passwordError.value = ''

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的密码不一致'
    return
  }

  if (newPassword.value.length < 8) {
    passwordError.value = '新密码长度至少为8位'
    return
  }

  isLoading.value = true
  try {
    await userApi.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    toast.success('密码修改成功')
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    await authStore.logout()
  } catch (error: unknown) {
    const apiError = error as ApiError
    const message = apiError.response?.data?.message || '密码修改失败，请检查当前密码'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(async () => {
  await authStore.fetchUser()
})
</script>

<template>
  <div class="max-w-xl mx-auto px-6 py-12 space-y-12">
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
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold tracking-tight">{{ user?.fullName || '用户' }}</h1>
        <p class="text-muted-foreground text-sm">{{ user?.email }}</p>
        <Badge :variant="user?.isAdmin ? 'default' : 'secondary'">
          {{ user?.isAdmin ? '管理员' : '普通用户' }}
        </Badge>
      </div>
    </header>

    <section class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-muted-foreground">账号信息</h2>
      </div>
      <div class="space-y-px">
        <div class="flex justify-between py-3 border-b">
          <span class="text-sm text-muted-foreground">用户名</span>
          <span class="text-sm font-medium">{{ user?.fullName || '-' }}</span>
        </div>
        <div class="flex justify-between py-3 border-b">
          <span class="text-sm text-muted-foreground">邮箱</span>
          <span class="text-sm font-medium">{{ user?.email }}</span>
        </div>
        <div class="flex justify-between py-3">
          <span class="text-sm text-muted-foreground">注册时间</span>
          <span class="text-sm font-medium">{{ formatDate(user?.createdAt) }}</span>
        </div>
      </div>
    </section>

    <section class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-muted-foreground">修改密码</h2>
      </div>
      <form @submit.prevent="handlePasswordChange" class="space-y-4">
        <div class="space-y-2">
          <Label for="currentPassword" class="text-sm">当前密码</Label>
          <Input
            id="currentPassword"
            type="password"
            v-model="currentPassword"
            required
            :disabled="isLoading"
            class="h-10"
          />
        </div>
        <div class="space-y-2">
          <Label for="newPassword" class="text-sm">新密码</Label>
          <Input
            id="newPassword"
            type="password"
            v-model="newPassword"
            required
            :disabled="isLoading"
            class="h-10"
          />
          <p class="text-xs text-muted-foreground">密码长度至少8位</p>
        </div>
        <div class="space-y-2">
          <Label for="confirmPassword" class="text-sm">确认密码</Label>
          <Input
            id="confirmPassword"
            type="password"
            v-model="confirmPassword"
            required
            :disabled="isLoading"
            class="h-10"
          />
        </div>
        <p v-if="passwordError" class="text-sm text-destructive">{{ passwordError }}</p>
        <Button type="submit" :disabled="isLoading" class="w-full h-10">
          {{ isLoading ? '保存中...' : '保存更改' }}
        </Button>
      </form>
    </section>
  </div>
</template>
