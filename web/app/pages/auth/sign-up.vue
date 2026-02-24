<template>
  <div class="w-full max-w-[400px] p-4">
    <u-card
      variant="outline"
    >
      <template #header>
        <h2 class="text-2xl font-bold text-center">
          系统注册
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
            placeholder="邮箱"
            type="email"
            class="w-full"
          />
        </u-form-field>

        <u-form-field
          label="用户名"
          name="name"
          size="lg"
        >
          <u-input
            v-model="state.name"
            placeholder="用户名"
            class="w-full"
          />
        </u-form-field>

        <u-form-field
          label="密码"
          name="password"
          size="lg"
        >
          <u-input
            v-model="state.password"
            placeholder="密码"
            type="password"
            class="w-full"
          />
        </u-form-field>

        <u-button
          type="submit"
          block
          :loading="loading"
          color="primary"
        >
          注册
        </u-button>
      </u-form>

      <div class="text-center mt-4">
        <nuxt-link
          to="/auth/sign-in"
          class="text-primary font-medium transition-all duration-200 ease hover:text-primary/80 hover:underline"
        >
          已有账号？去登录
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
  name: '',
  password: ''
})

const onSubmit = async () => {
  loading.value = true
  try {
    const result = await authStore.register(state.email, state.password, state.name)
    if (!result) return

    toast.add({ title: '注册成功', color: 'success' })
    await router.replace(redirectPath.value)
  } catch {
    // 错误由 API 插件统一处理
  } finally {
    loading.value = false
  }
}
</script>
