<template>
  <div
    v-if="shouldShow"
    class="inline-flex items-center gap-2"
  >
    <u-tooltip text="邮箱未验证将无法接收邮件通知、部分功能受限">
      <u-icon
        name="i-lucide-alert-triangle"
        class="size-4 text-muted-foreground cursor-help"
      />
    </u-tooltip>
    <span class="text-sm text-muted-foreground">
      请验证邮箱
    </span>
    <u-button
      :label="sending ? '发送中...' : '发送验证邮件'"
      variant="link"
      size="sm"
      color="neutral"
      :disabled="sending"
      @click="handleResend"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const { $api } = useNuxtApp()
const toast = useToast()

const shouldShow = computed(() =>
  authStore.isAuthenticated && !authStore.isEmailVerified
)

const sending = ref(false)

const handleResend = async () => {
  if (sending.value) return

  sending.value = true

  await $api('/user/resend-verification', { method: 'post' })

  await authStore.fetchUser()

  toast.add({
    title: '验证邮件已发送',
    description: '请检查您的邮箱',
    color: 'success',
    icon: 'i-heroicons-envelope'
  })

  sending.value = false
}
</script>
