<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const email = ref('')
const errors = ref<{ email?: string }>({})
const isSubmitted = ref(false)

const validate = () => {
  const newErrors: { email?: string } = {}

  if (!email.value) {
    newErrors.email = '请输入邮箱地址'
  } else if (!/\S+@\S+\.\S+/.test(email.value)) {
    newErrors.email = '请输入有效的邮箱地址'
  }

  errors.value = newErrors
  return Object.keys(newErrors).length === 0
}

const handleSubmit = async () => {
  if (!validate()) return

  try {
    await authStore.forgotPassword(email.value)
    isSubmitted.value = true
    toast.success('重置链接已发送到您的邮箱')
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '发送失败，请稍后重试')
  }
}
</script>

<template>
    <Card v-if="!isSubmitted" class="w-full max-w-sm mx-auto">
      <CardHeader class="text-center">
        <CardTitle class="text-xl">忘记密码</CardTitle>
        <CardDescription>输入您的邮箱地址，我们将发送密码重置链接</CardDescription>
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
              :class="{ 'border-destructive': errors.email }"
            />
            <p v-if="errors.email" class="text-sm text-destructive">{{ errors.email }}</p>
          </div>

          <Button type="submit" class="w-full" :disabled="authStore.isLoading">
            {{ authStore.isLoading ? '发送中...' : '发送重置链接' }}
          </Button>
        </form>

        <div class="mt-4 text-center text-sm text-muted-foreground">
          想起密码了？
          <RouterLink to="/auth/sign-in" class="text-primary hover:underline">
            立即登录
          </RouterLink>
        </div>
      </CardContent>
    </Card>

    <Card v-else class="w-full max-w-sm mx-auto">
      <CardHeader class="text-center">
        <CardTitle class="text-xl">邮件已发送</CardTitle>
        <CardDescription>
          我们已向您的邮箱发送了密码重置链接，请查收
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="text-center space-y-4">
          <p class="text-sm text-muted-foreground">
            没有收到邮件？请检查垃圾邮件或
            <button
              @click="isSubmitted = false"
              class="text-primary hover:underline ml-1"
            >
              重新发送
            </button>
          </p>
          <RouterLink to="/auth/sign-in">
            <Button variant="outline" class="w-full">
              返回登录
            </Button>
          </RouterLink>
        </div>
      </CardContent>
    </Card>
</template>
