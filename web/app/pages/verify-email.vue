<template>
  <div class="w-full p-4 h-screen flex items-center justify-center">
    <u-card
      class=" min-w-3/12 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-gray-200 dark:border-gray-700"
      variant="outline"
    >
      <template #header>
        <h2 class="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
          邮箱验证
        </h2>
      </template>

      <div
        v-if="loading"
        class="flex flex-col items-center justify-center py-8"
      >
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"
        />
        <p class="mt-4 text-gray-600 dark:text-gray-400">
          正在验证您的邮箱...
        </p>
      </div>

      <div
        v-else-if="success"
        class="flex flex-col items-center justify-center py-6"
      >
        <div
          class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4"
        >
          <u-icon
            name="i-heroicons-check-circle"
            class="w-10 h-10 text-green-500"
          />
        </div>
        <u-alert
          color="success"
          variant="subtle"
          icon="i-heroicons-check-circle"
          title="验证成功"
          class="w-full"
        >
          您的邮箱已验证成功，正在跳转...
        </u-alert>
      </div>

      <div
        v-else-if="error"
        class="flex flex-col items-center justify-center py-6"
      >
        <div
          class="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4"
        >
          <u-icon
            name="i-heroicons-x-mark"
            class="w-10 h-10 text-red-500"
          />
        </div>
        <u-alert
          color="error"
          variant="subtle"
          icon="i-heroicons-x-mark"
          title="验证失败"
          class="w-full"
        >
          {{ error }}
        </u-alert>
        <div class="flex flex-col gap-2 w-full mt-4">
          <u-button
            color="primary"
            block
            :loading="resending"
            @click="resendVerification"
          >
            重新发送验证邮件
          </u-button>
          <nuxt-link
            to="/"
            class="text-center text-primary-500 dark:text-primary-300 font-medium transition-all duration-200 ease hover:text-primary-600 dark:hover:text-primary-200 hover:underline"
          >
            返回工作台
          </nuxt-link>
        </div>
      </div>
    </u-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from '#app'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { $api } = useNuxtApp()

const loading = ref(true)
const success = ref(false)
const error = ref('')
const resending = ref(false)

const redirectPath = computed(() => {
  const redirect = route.query.redirect as string
  return redirect && redirect.startsWith('/') ? redirect : '/'
})

const emailToken = (route.query.emailToken as string) || ''

const resendVerification = async () => {
  resending.value = true

  try {
    await $api('/user/resend-verification', { method: 'post' })
    toast.add({
      title: '发送成功',
      description: '验证邮件已重新发送，请检查您的邮箱',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
  } catch (err: any) {
    toast.add({
      title: '发送失败',
      description: err.message || '请稍后重试',
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
  } finally {
    resending.value = false
  }
}

onMounted(async () => {
  if (!emailToken) {
    error.value = '验证链接无效，缺少验证令牌'
    toast.add({
      title: '验证失败',
      description: '验证链接无效，缺少验证令牌',
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
    loading.value = false
    return
  }

  const result = await $api(`/user/verify-email?emailToken=${emailToken}`, { method: 'get' }).catch(() => {
    success.value = false
    error.value = '验证链接无效或已过期'
  })

  if (result) {
    success.value = true
    await authStore.fetchUser()
    setTimeout(() => {
      router.replace(redirectPath.value)
    }, 2000)
  } else {
    error.value = '验证失败，请稍后重试'
  }

  loading.value = false
})
</script>
