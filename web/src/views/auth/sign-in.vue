<script setup lang="ts">
import { isAxiosError } from 'axios'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)

const handleSubmit = async () => {
  try {
    await authStore.login({
      email: email.value,
      password: password.value,
      rememberMe: rememberMe.value,
    })
    toast.success('登录成功')
    router.push('/learning')
  } catch (error) {
    let message = '登录失败，请检查邮箱和密码'
    if (isAxiosError(error)) {
      message = error.response?.data?.message || message
    }
    toast.error(message)
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
              required
              :disabled="authStore.isLoading"
            />
          </div>

          <div class="space-y-2">
            <Label for="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              v-model="password"
              required
              :disabled="authStore.isLoading"
            />
          </div>

          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                v-model="rememberMe"
                class="rounded border-border"
              />
              <span class="text-muted-foreground">记住我</span>
            </label>
            <RouterLink
              to="/auth/forgot-password"
              class="text-sm text-primary hover:underline"
            >
              忘记密码？
            </RouterLink>
          </div>

          <Button type="submit" class="w-full" :disabled="authStore.isLoading">
            {{ authStore.isLoading ? '登录中...' : '登录' }}
          </Button>
        </form>

        <div class="mt-4 text-center text-sm text-muted-foreground">
          还没有账户？
          <RouterLink to="/auth/sign-up" class="text-primary hover:underline">
            立即注册
          </RouterLink>
        </div>
      </CardContent>
    </Card>
</template>
