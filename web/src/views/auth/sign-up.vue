<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

const errors = reactive<{ name?: string; email?: string; password?: string; confirmPassword?: string }>({})

const validateName = (value: string): string | undefined => {
  if (!value.trim()) {
    return '请输入用户名'
  }
  if (value.trim().length < 2) {
    return '用户名至少需要2个字符'
  }
  if (value.trim().length > 50) {
    return '用户名不能超过50个字符'
  }
  return undefined
}

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
  if (value.length < 8) {
    return '密码至少需要8个字符'
  }
  if (value.length > 16) {
    return '密码不能超过16个字符'
  }
  return undefined
}

const validateConfirmPassword = (value: string): string | undefined => {
  if (!value) {
    return '请再次输入密码'
  }
  if (value !== password.value) {
    return '两次输入的密码不一致'
  }
  return undefined
}

const handleSubmit = async () => {
  errors.name = validateName(name.value)
  errors.email = validateEmail(email.value)
  errors.password = validatePassword(password.value)
  errors.confirmPassword = validateConfirmPassword(confirmPassword.value)

  if (errors.name || errors.email || errors.password || errors.confirmPassword) {
    return
  }

  const result = await authStore.register({ name: name.value.trim(), email: email.value, password: password.value })
  if (result) {
    toast.success('注册成功')
    await router.push('/learning')
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
              :disabled="authStore.isLoading"
              @blur="errors.name = validateName(name)"
            />
            <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
          </div>

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
              placeholder="8-16个字符"
              v-model="password"
              :disabled="authStore.isLoading"
              @blur="errors.password = validatePassword(password)"
            />
            <p v-if="errors.password" class="text-sm text-destructive">{{ errors.password }}</p>
          </div>

          <div class="space-y-2">
            <Label for="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              v-model="confirmPassword"
              :disabled="authStore.isLoading"
              @blur="errors.confirmPassword = validateConfirmPassword(confirmPassword)"
            />
            <p v-if="errors.confirmPassword" class="text-sm text-destructive">{{ errors.confirmPassword }}</p>
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
