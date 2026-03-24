<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)

const errors = reactive<{ email?: string; password?: string }>({})

const validateEmail = (value: string): string | undefined => {
  if (!value.trim()) {
    return '请输入邮箱'
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return '请输入有效的邮箱地址'
  }
  return undefined
}

const validatePassword = (value: string): string | undefined => {
  if (!value) {
    return '请输入密码'
  }
  return undefined
}

const handleSubmit = async () => {
  errors.email = validateEmail(email.value)
  errors.password = validatePassword(password.value)

  if (errors.email || errors.password) {
    return
  }

  const result = await authStore.login({
    email: email.value,
    password: password.value,
    rememberMe: rememberMe.value,
  })
  if (result) {
    toast.success('登录成功')
    await router.push('/learning')
  }
}

const handleGithubLogin = async () => {
  await authStore.loginWithOAuth('github')
}
</script>

<template>
  <Card class="w-full max-w-sm mx-auto">
    <CardHeader class="text-center">
      <CardTitle class="text-xl">登录</CardTitle>
      <CardDescription>欢迎回来！请登录您的账户</CardDescription>
    </CardHeader>
    <CardContent>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label for="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            v-model="email"
            :disabled="authStore.isLoading"
            @blur="errors.email = validateEmail(email)"
          />
          <p v-if="errors.email" class="text-sm text-destructive">{{ errors.email }}</p>
        </div>

        <div class="space-y-2">
          <Label for="password">密码</Label>
          <Input
            id="password"
            type="password"
            placeholder="请输入密码"
            v-model="password"
            :disabled="authStore.isLoading"
            @blur="errors.password = validatePassword(password)"
          />
          <p v-if="errors.password" class="text-sm text-destructive">{{ errors.password }}</p>
        </div>

        <div class="flex items-center justify-between">
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" v-model="rememberMe" class="rounded border-border" />
            <span class="text-muted-foreground">30天免登录</span>
          </label>
          <RouterLink to="/auth/forgot-password" class="text-sm text-primary hover:underline"> 忘记密码？ </RouterLink>
        </div>

        <Button type="submit" class="w-full" :disabled="authStore.isLoading">
          {{ authStore.isLoading ? '登录中...' : '登录' }}
        </Button>

        <div class="relative my-4">
          <div class="absolute inset-0 flex items-center">
            <span class="w-full border-t" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-card px-2 text-muted-foreground">或</span>
          </div>
        </div>

        <Button variant="outline" type="button" class="w-full" @click="handleGithubLogin" :disabled="authStore.isLoading">
          <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          使用 GitHub 登录
        </Button>
      </form>

      <div class="mt-4 text-center text-sm text-muted-foreground">
        还没有账户？
        <RouterLink to="/auth/sign-up" class="text-primary hover:underline"> 立即注册 </RouterLink>
      </div>
    </CardContent>
  </Card>
</template>
