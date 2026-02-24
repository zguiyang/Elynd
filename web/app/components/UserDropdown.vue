<template>
  <u-dropdown-menu
    :items="menuItems"
    :content="{ align: 'end' }"
  >
    <template #default>
      <u-avatar
        :src="avatarUrl || undefined"
        :alt="user?.fullName || user?.email || 'User'"
        size="md"
        class="cursor-pointer ring-2 ring-transparent hover:ring-primary-500 transition-all"
      >
        <template #fallback>
          {{ (user?.fullName || user?.email || 'U').charAt(0).toUpperCase() }}
        </template>
      </u-avatar>
    </template>
  </u-dropdown-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const colorMode = useColorMode()
const toast = useToast()
const getAvatarUrl = useAvatarUrl()

const user = computed(() => authStore.user)
const isDark = computed(() => colorMode.value === 'dark')

const avatarUrl = computed(() => getAvatarUrl(user.value?.avatar))

const menuItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      type: 'label',
      label: user.value?.email || user.value?.fullName || '用户',
      avatar: {
        src: avatarUrl.value || undefined,
        alt: user.value?.email || user.value?.fullName || 'User'
      }
    }
  ],
  [
    {
      label: isDark.value ? 'Dark Mode' : 'Light Mode',
      icon: isDark.value ? 'i-heroicons-moon' : 'i-heroicons-sun',
      onSelect: () => {
        colorMode.preference = isDark.value ? 'light' : 'dark'
      }
    }
  ],
  [
    {
      type: 'separator'
    },
    {
      label: '退出登录',
      icon: 'i-heroicons-arrow-right-on-rectangle',
      color: 'error',
      onSelect: handleLogout
    }
  ]
])

const handleLogout = async () => {
  await authStore.logout()
  toast.add({
    title: '已退出登录',
    color: 'neutral',
    icon: 'i-heroicons-arrow-right-on-rectangle'
  })
  await navigateTo('/auth/sign-in')
}
</script>
