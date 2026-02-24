<template>
  <div class="w-full max-w-[400px] p-4">
    <u-card
      class="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border border-neutral-200 dark:border-neutral-700"
      variant="outline"
    >
      <template #header>
        <h2 class="text-2xl font-bold text-center text-neutral-900 dark:text-neutral-100">
          忘记密码
        </h2>
      </template>

      <u-form
        :state="state"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <u-form-field
          label="邮箱"
          name="email"
          size="lg"
        >
          <u-input
            v-model="state.email"
            placeholder="请输入您的注册邮箱"
            type="email"
            class="w-full"
          />
        </u-form-field>

        <u-button
          type="submit"
          block
          :loading="loading"
          class="bg-primary-500 hover:bg-primary-600 text-primary-foreground"
        >
          发送重置链接
        </u-button>
      </u-form>

      <u-alert
        v-if="success"
        color="success"
        variant="subtle"
        icon="i-heroicons-check-circle"
        title="发送成功"
        class="mt-4"
      >
        重置邮件已发送，请检查您的邮箱
      </u-alert>

      <div class="text-center mt-4">
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

definePageMeta({ layout: 'auth' })

const loading = ref(false)
const toast = useToast()
const { $api } = useNuxtApp()

const state = reactive({
  email: ''
})

const success = ref(false)

const onSubmit = async () => {
  loading.value = true
  success.value = false

  const result = await $api('/auth/forgot-password', {
    method: 'post',
    body: { email: state.email }
  })

  if (result) {
    success.value = true
    toast.add({
      title: '发送成功',
      description: '重置邮件已发送，请检查您的邮箱',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    setTimeout(() => {
      navigateTo('/auth/sign-in')
    }, 3000)
  }

  loading.value = false
}
</script>
