<script setup lang="ts">
import { isAxiosError } from 'axios'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

const handleSubmit = async () => {
  try {
    await authStore.register({ name: name.value, email: email.value, password: password.value })
    toast.success('注册成功')
    router.push('/learning')
  } catch (error) {
    let message = '注册失败，请稍后重试'
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
        <CardTitle class="text-xl">创建账户</CardTitle>
        <CardDescription>开始您的学习之旅</CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <Label for="name">用户名</Label>
            <Input
              id="name"
              type="text"
              placeholder="请输入用户名"
              v-model="name"
              required
              :disabled="authStore.isLoading"
            />
          </div>

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
              placeholder="至少6个字符"
              v-model="password"
              required
              :disabled="authStore.isLoading"
            />
          </div>

          <div class="space-y-2">
            <Label for="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              v-model="confirmPassword"
              required
              :disabled="authStore.isLoading"
            />
          </div>

          <Button type="submit" class="w-full" :disabled="authStore.isLoading">
            {{ authStore.isLoading ? '注册中...' : '注册' }}
          </Button>
        </form>

        <div class="mt-4 text-center text-sm text-muted-foreground">
          已有账户？
          <RouterLink to="/auth/sign-in" class="text-primary hover:underline">
            立即登录
          </RouterLink>
        </div>
      </CardContent>
    </Card>
</template>
