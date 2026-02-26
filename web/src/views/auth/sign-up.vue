<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useDebounceFn } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

const errors = ref<{
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}>({})

const validate = useDebounceFn(() => {
  const newErrors: typeof errors.value = {}

  if (!name.value) {
    newErrors.name = '请输入用户名'
  } else if (name.value.length < 2) {
    newErrors.name = '用户名至少需要2个字符'
  }

  if (!email.value) {
    newErrors.email = '请输入邮箱地址'
  } else if (!/\S+@\S+\.\S+/.test(email.value)) {
    newErrors.email = '请输入有效的邮箱地址'
  }

  if (!password.value) {
    newErrors.password = '请输入密码'
  } else if (password.value.length < 6) {
    newErrors.password = '密码至少需要6个字符'
  }

  if (!confirmPassword.value) {
    newErrors.confirmPassword = '请确认密码'
  } else if (password.value !== confirmPassword.value) {
    newErrors.confirmPassword = '两次输入的密码不一致'
  }

  errors.value = newErrors
}, 300)

watch([name, email, password, confirmPassword], () => {
  validate()
}, { flush: 'post' })

const validateImmediate = () => {
  const newErrors: typeof errors.value = {}

  if (!name.value) {
    newErrors.name = '请输入用户名'
  } else if (name.value.length < 2) {
    newErrors.name = '用户名至少需要2个字符'
  }

  if (!email.value) {
    newErrors.email = '请输入邮箱地址'
  } else if (!/\S+@\S+\.\S+/.test(email.value)) {
    newErrors.email = '请输入有效的邮箱地址'
  }

  if (!password.value) {
    newErrors.password = '请输入密码'
  } else if (password.value.length < 6) {
    newErrors.password = '密码至少需要6个字符'
  }

  if (!confirmPassword.value) {
    newErrors.confirmPassword = '请确认密码'
  } else if (password.value !== confirmPassword.value) {
    newErrors.confirmPassword = '两次输入的密码不一致'
  }

  errors.value = newErrors
  return Object.keys(newErrors).length === 0
}

const handleSubmit = async () => {
  if (!validateImmediate()) return

  try {
    await authStore.register({ name: name.value, email: email.value, password: password.value })
    toast.success('注册成功')
    router.push('/learning')
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '注册失败，请稍后重试')
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
            />
            <p v-if="errors.email" class="text-sm text-destructive">{{ errors.email }}</p>
          </div>

          <div class="space-y-2">
            <Label for="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="至少6个字符"
              v-model="password"
              :disabled="authStore.isLoading"
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
