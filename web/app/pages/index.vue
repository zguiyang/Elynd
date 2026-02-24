<template>
  <div class="min-h-screen flex flex-col">
    <div class="bg-primary-500 dark:bg-primary-400 py-2 px-4 text-center">
      <p class="text-xs sm:text-sm font-medium text-white dark:text-gray-900">
        Elynd 目前处于 Beta 测试阶段，如有任何问题或建议，欢迎
        <a
          href="https://github.com/zguiyang/Linky/issues"
          target="_blank"
          class="underline decoration-2 underline-offset-2 hover:opacity-80 transition-opacity"
        >
          提交 Issue
        </a>
      </p>
    </div>

    <u-header
      to="/"
    >
      <template #title>
        <div class="flex items-center gap-2">
          <div class="bg-primary-500 rounded-lg p-1.5 flex items-center justify-center">
            <u-icon
              name="i-heroicons-bookmark-square"
              class="w-6 h-6 text-white"
            />
          </div>
          <span class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Elynd</span>
        </div>
      </template>

      <template #right>
        <client-only>
          <u-button
            :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
            color="neutral"
            variant="ghost"
            aria-label="Theme"
            @click="isDark = !isDark"
          />
        </client-only>

        <u-button
          v-bind="entryButton"
        />
      </template>
    </u-header>

    <u-main>
      <u-page-hero
        title="您的个人知识管理空间"
        description="高效管理书签、记录灵感想法、让知识触手可及。Elynd 帮助您构建第二大脑，将碎片化信息转化为有价值的知识库。"
        :links="heroLinks"
        align="center"
      >
        <template #headline>
          <u-badge
            variant="subtle"
            size="md"
            class="rounded-full"
          >
            全新上线
          </u-badge>
        </template>

        <template #top>
          <div class="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-primary-400/30 to-purple-400/30 blur-[100px] rounded-full opacity-50 dark:opacity-30" />
          </div>
        </template>
      </u-page-hero>

      <u-page-section
        id="features"
        title="功能特性"
        description="一站式知识管理解决方案，让信息组织变得简单愉快"
        class="bg-gray-50/50 dark:bg-gray-900/50"
      >
        <u-page-grid>
          <u-page-card
            v-for="(feature, index) in features"
            :key="index"
            :title="feature.title"
            :description="feature.description"
            :icon="feature.icon"
          />
        </u-page-grid>
      </u-page-section>

      <u-page-section
        title="开启您的知识探索之旅"
        description="立即加入 Elynd，构建您的数字第二大脑，让灵感与知识不再流失。"
        align="center"
        class="pb-24"
      >
        <div class="flex flex-col items-center gap-6">
          <div class="flex flex-wrap justify-center gap-4">
            <u-button
              v-bind="entryButton"
              size="xl"
              class="px-8 py-3 rounded-full shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all duration-300"
            />
            <u-button
              label="给个star"
              to="https://github.com/zguiyang/Linky"
              target="_blank"
              size="xl"
              variant="outline"
              color="neutral"
              icon="i-simple-icons-github"
              class="px-8 py-3 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300"
            />
          </div>
        </div>

        <template #top>
          <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />
          <div class="absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-500/5 blur-[120px] rounded-full -z-10" />
        </template>
      </u-page-section>
    </u-main>

    <u-footer>
      <template #left>
        <div class="flex items-center gap-2">
          <u-icon
            name="i-heroicons-bookmark-square"
            class="w-5 h-5 text-primary-500"
          />
          <span class="text-sm font-bold text-gray-900 dark:text-white">Elynd</span>
        </div>
        <span class="text-sm text-gray-500 dark:text-gray-400 ml-4 hidden sm:inline-block">
          &copy; {{ new Date().getFullYear() }} Elynd. All rights reserved.
        </span>
      </template>

      <template #right>
        <u-button
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
          to="https://github.com/zguiyang/Linky"
          target="_blank"
        />
      </template>

      <template #center>
        <span class="text-sm text-gray-500 dark:text-gray-400 sm:hidden">
          &copy; {{ new Date().getFullYear() }} Elynd
        </span>
      </template>
    </u-footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'marketing' })

const authStore = useAuthStore()
const colorMode = useColorMode()

const isDark = computed({
  get() {
    return colorMode.value === 'dark'
  },
  set() {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  }
})

const entryButton = computed(() => ({
  label: authStore.isAuthenticated ? '进入工作区' : '开始使用',
  to: authStore.isAuthenticated ? '/' : '/auth/sign-in',
  icon: authStore.isAuthenticated ? 'i-heroicons-computer-desktop' : 'i-heroicons-rocket-launch',
  color: 'primary' as const,
  variant: 'solid' as const,
  size: 'xl' as const
}))

const heroLinks = computed(() => [
  {
    label: entryButton.value.label,
    to: entryButton.value.to,
    icon: entryButton.value.icon,
    color: entryButton.value.color,
    variant: entryButton.value.variant,
    size: 'xl' as const
  },
  {
    label: '了解更多',
    to: '#features',
    size: 'xl' as const,
    variant: 'outline' as const,
    color: 'neutral' as const,
    icon: 'i-heroicons-arrow-down-circle'
  }
])

const features = [
  {
    title: '书签管理',
    description: '高效管理您的网络书签，支持分类整理和智能标签，让链接井井有条，不再丢失任何精彩内容。',
    icon: 'i-heroicons-bookmark'
  },
  {
    title: '闪念备忘',
    description: '快速记录稍纵即逝的想法、灵感和重要信息。支持 Markdown 格式，随时随地访问您的笔记。',
    icon: 'i-heroicons-document-text'
  },
  {
    title: '标签系统',
    description: '灵活的多维标签分类系统，打破传统文件夹的限制，让信息组织更加高效和个性化。',
    icon: 'i-heroicons-tag'
  },
  {
    title: '快速搜索',
    description: '强大的全文搜索引擎，支持模糊匹配。通过关键词快速找到书签或备忘录，大幅提升工作效率。',
    icon: 'i-heroicons-magnifying-glass'
  },
  {
    title: '安全隐私',
    description: '基于 Access Token 的安全认证机制，数据加密传输，全方位保护您的个人数据隐私安全。',
    icon: 'i-heroicons-shield-check'
  },
  {
    title: '多端同步',
    description: '无论是电脑、平板还是手机，Elynd 都能完美适配，让您的知识库时刻伴随左右。',
    icon: 'i-heroicons-device-phone-mobile'
  }
]
</script>

<style scoped>
html {
  scroll-behavior: smooth;
}
</style>
