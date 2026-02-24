<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="max-w-md w-full p-4">
      <u-card class="text-center">
        <template #header>
          <div
            class="w-20 h-20 mx-auto mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full"
          >
            <u-icon
              name="i-heroicons-exclamation-triangle"
              class="w-10 h-10 text-gray-400 dark:text-gray-500"
            />
          </div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ error.statusCode || 'Error' }}
          </h1>
        </template>

        <template #body>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            {{ error.statusMessage || error.message || '抱歉，页面出错了' }}
          </p>
        </template>

        <template #footer>
          <nuxt-link to="/">
            <u-button
              block
              color="primary"
            > 返回首页 </u-button>
          </nuxt-link>
        </template>
      </u-card>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  error: {
    type: Object,
    required: true
  }
})

// Clear error on load
clearError({ redirect: '/' })
</script>
