<template>
  <div class="w-full max-w-[400px] p-4">
    <u-card
      class="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-gray-200 dark:border-gray-700"
      variant="outline"
    >
      <template #header>
        <h2 class="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
          重置密码
        </h2>
      </template>

      <u-form
        ref="formRef"
        :state="state"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <u-form-field
          label="新密码"
          name="password"
          size="lg"
        >
          <u-input
            v-model="state.password"
            placeholder="请输入新密码（至少8个字符）"
            type="password"
            class="w-full"
          />
        </u-form-field>

        <u-form-field
          label="确认新密码"
          name="passwordConfirmation"
          size="lg"
        >
          <u-input
            v-model="state.passwordConfirmation"
            placeholder="请再次输入新密码"
            type="password"
            class="w-full"
          />
        </u-form-field>

        <p class="text-sm text-gray-600 dark:text-gray-400">
          密码至少需要 8 个字符
        </p>

        <u-button
          type="submit"
          block
          :loading="loading"
          class="bg-primary-500 hover:bg-primary-600 text-white"
        >
          重置密码
        </u-button>
      </u-form>

      <u-alert
        v-if="success"
        color="success"
        variant="subtle"
        icon="i-heroicons-check-circle"
        title="重置成功"
        class="mt-4"
      >
        密码重置成功，正在登录...
      </u-alert>

      <u-alert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-heroicons-x-mark"
        title="重置失败"
        class="mt-4"
      >
        {{ error }}
      </u-alert>

      <div class="text-center mt-4">
        <nuxt-link
          v-if="showRetryLink"
          to="/auth/forgot-password"
          class="text-primary-500 dark:text-primary-300 font-medium transition-all duration-200 ease hover:text-primary-600 dark:hover:text-primary-200 hover:underline"
        >
          重新发送重置链接
        </nuxt-link>
        <nuxt-link
          to="/auth/sign-in"
          class="text-primary-500 dark:text-primary-300 font-medium transition-all duration-200 ease hover:text-primary-600 dark:hover:text-primary-200 hover:underline"
        >
          ← 返回登录
        </nuxt-link>
      </div>
    </u-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute } from '#app'
import { useAuthStore } from '~/stores/auth'
import type { AuthResponse } from '~/api/types'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const authStore = useAuthStore()
const loading = ref(false)
const toast = useToast()
const { $api } = useNuxtApp()

const success = ref(false)
const error = ref('')
const showRetryLink = ref(false)

const token = (route.query.token as string) || ''

const state = reactive({
  password: '',
  passwordConfirmation: '',
  token
})

const onSubmit = async () => {
  error.value = ''
  success.value = false
  showRetryLink.value = false

  if (state.password !== state.passwordConfirmation) {
    error.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  try {
    const authData = await $api<AuthResponse>('/auth/reset-password', {
      method: 'post',
      body: {
        token: state.token,
        password: state.password,
        passwordConfirmation: state.passwordConfirmation
      }
    })

    authStore.setUser(authData.user)
    authStore.setToken(authData.token)

    success.value = true
    toast.add({
      title: '密码重置成功',
      description: '已自动登录',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    setTimeout(() => {
      navigateTo('/')
    }, 2000)
  } catch (err: any) {
    const errorMessage = err.message || ''
    error.value = errorMessage
    if (errorMessage.includes('过期') || errorMessage.includes('无效')) {
      showRetryLink.value = true
    }
  } finally {
    loading.value = false
  }
}
</script>
