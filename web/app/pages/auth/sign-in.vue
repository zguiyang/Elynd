<template>
  <div class="w-full max-w-[400px] p-4">
    <u-card
      variant="outline"
    >
      <template #header>
        <h2 class="text-2xl font-bold text-center">
          系统登录
        </h2>
      </template>

      <u-form
        ref="formRef"
        :state="state"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <u-form-field
          label="Email"
          name="email"
          size="lg"
        >
          <u-input
            v-model="state.email"
            placeholder="Email"
            type="email"
            class="w-full"
          />
        </u-form-field>

        <u-form-field
          label="Password"
          name="password"
          size="lg"
        >
          <u-input
            v-model="state.password"
            placeholder="Password"
            type="password"
            class="w-full"
          />
        </u-form-field>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <u-checkbox v-model="state.rememberMe" />
            <span class="text-sm text-neutral-700 dark:text-neutral-300">30天免登录</span>
          </div>
          <nuxt-link
            to="/auth/forgot-password"
            class="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            忘记密码？
          </nuxt-link>
        </div>

        <u-button
          type="submit"
          block
          :loading="loading"
          color="primary"
        >
          登录
        </u-button>
      </u-form>

      <div class="text-center mt-4">
        <nuxt-link
          to="/auth/sign-up"
          class="text-primary font-medium transition-all duration-200 ease hover:text-primary/80 hover:underline"
        >
          注册新账号
        </nuxt-link>
      </div>
    </u-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const toast = useToast()

const redirectPath = computed(() => {
  const redirect = route.query.redirect as string
  return redirect && redirect.startsWith('/') ? redirect : '/'
})

const state = reactive({
  email: '',
  password: '',
  rememberMe: false
})

const onSubmit = async () => {
  loading.value = true
  try {
    const result = await authStore.login(state.email, state.password, state.rememberMe)
    if (!result) return

    toast.add({ title: '登录成功', color: 'success' })
    await router.replace(redirectPath.value)
  } catch {
    // 错误由 API 插件统一处理
  } finally {
    loading.value = false
  }
}
</script>
