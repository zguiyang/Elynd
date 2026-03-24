<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

onMounted(async () => {
  const provider = route.params.provider as string
  const code = route.query.code as string | undefined
  const rememberMe = route.query.rememberMe === 'true'

  if (!code) {
    toast.error('授权失败：缺少授权码')
    await router.push('/auth/sign-in')
    return
  }

  const success = await authStore.handleOAuthCallback(provider, code, rememberMe)

  if (success) {
    toast.success('登录成功')
    await router.push('/learning')
  } else {
    toast.error(`${provider} 登录失败，请重试`)
    await router.push('/auth/sign-in')
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="mb-4">
        <svg class="w-12 h-12 mx-auto animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      <p class="text-muted-foreground">正在处理授权登录...</p>
    </div>
  </div>
</template>
