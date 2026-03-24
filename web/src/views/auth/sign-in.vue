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
      </form>

      <div class="mt-4 text-center text-sm text-muted-foreground">
        还没有账户？
        <RouterLink to="/auth/sign-up" class="text-primary hover:underline"> 立即注册 </RouterLink>
      </div>
    </CardContent>
  </Card>
</template>
