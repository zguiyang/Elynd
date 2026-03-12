<script setup lang="ts">
import { useReadingSettingsStore } from '@/stores/reading-settings'

interface Props {
  paragraphs: string[]
  chapterTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  chapterTitle: undefined,
})

const readingSettings = useReadingSettingsStore()

const contentStyle = computed(() => ({
  fontSize: readingSettings.fontSizeCss,
  lineHeight: readingSettings.lineHeightCss,
}))
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div
      class="mx-auto w-full transition-all duration-300 py-8"
      :style="{
        maxWidth: readingSettings.contentWidthCss,
        ...contentStyle,
      }"
    >
      <h2
        v-if="props.chapterTitle"
        class="text-2xl font-bold text-foreground mb-8"
      >
        {{ props.chapterTitle }}
      </h2>

      <div class="text-foreground">
        <p
          v-for="(paragraph, index) in paragraphs"
          :key="index"
          class="mb-6 last:mb-0 indent-0"
        >
          {{ paragraph }}
        </p>
      </div>
    </div>
  </div>
</template>
