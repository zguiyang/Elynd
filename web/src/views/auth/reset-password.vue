<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const token = route.query.token as string | undefined

const password = ref('')
const confirmPassword = ref('')
const errors = ref<{
  password?: string
  confirmPassword?: string
}>({})
const isSuccess = ref(false)

const validate = () => {
  const newErrors: typeof errors.value = {}

  if (!password.value) {
    newErrors.password = '请输入新密码'
  } else if (password.value.length < 8) {
    newErrors.password = '密码至少需要8个字符'
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
  if (!validate()) return

  if (!token) {
    toast.error('无效的重置令牌')
    return
  }

  try {
    await authStore.resetPassword({
      token,
      password: password.value,
      passwordConfirmation: confirmPassword.value,
    })
    isSuccess.value = true
    toast.success('密码重置成功')
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '重置失败，请稍后重试')
  }
}
</script>

<template>
    <template v-if="!token">
      <Card class="w-full max-w-sm mx-auto">
        <CardHeader class="text-center">
          <CardTitle class="text-xl">链接无效</CardTitle>
          <CardDescription>此密码重置链接已失效或不存在</CardDescription>
        </CardHeader>
        <CardContent>
          <Button class="w-full" @click="router.push('/auth/forgot-password')">
            重新获取重置链接
          </Button>
        </CardContent>
      </Card>
    </template>

    <template v-else-if="isSuccess">
      <Card class="w-full max-w-sm mx-auto">
        <CardHeader class="text-center">
          <CardTitle class="text-xl">重置成功</CardTitle>
          <CardDescription>您的密码已成功重置</CardDescription>
        </CardHeader>
        <CardContent>
          <Button class="w-full" @click="router.push('/auth/sign-in')">
            立即登录
          </Button>
        </CardContent>
      </Card>
    </template>

    <template v-else>
      <Card class="w-full max-w-sm mx-auto">
        <CardHeader class="text-center">
          <CardTitle class="text-xl">重置密码</CardTitle>
          <CardDescription>请输入您的新密码</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="handleSubmit">
            <div class="space-y-2">
              <label class="text-sm font-medium" for="password">新密码</label>
              <Input
                id="password"
                v-model="password"
                type="password"
                placeholder="至少8个字符"
                :disabled="authStore.isLoading"
                :class="{ 'border-destructive': errors.password }"
              />
              <p v-if="errors.password" class="text-sm text-destructive">
                {{ errors.password }}
              </p>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium" for="confirmPassword">确认新密码</label>
              <Input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                :disabled="authStore.isLoading"
                :class="{ 'border-destructive': errors.confirmPassword }"
              />
              <p v-if="errors.confirmPassword" class="text-sm text-destructive">
                {{ errors.confirmPassword }}
              </p>
            </div>

            <Button
              type="submit"
              class="w-full"
              :disabled="authStore.isLoading"
            >
              {{ authStore.isLoading ? '重置中...' : '重置密码' }}
            </Button>
          </form>

          <div class="mt-4 text-center text-sm text-muted-foreground">
            <Button variant="link" class="p-0" @click="router.push('/auth/sign-in')">
              返回登录
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>
</template>
