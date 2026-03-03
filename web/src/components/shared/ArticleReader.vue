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
    <Card class="flex-1 min-h-0 flex flex-col border shadow-md mb-2 bg-card">
      <CardContent class="p-6 flex-1 min-h-0 overflow-y-auto">
        <div
          class="mx-auto transition-all duration-300"
          :style="{
            maxWidth: readingSettings.contentWidthCss,
            ...contentStyle,
          }"
        >
          <div v-if="props.chapterTitle" class="mb-6 pb-4 border-b">
            <h2 class="text-2xl font-bold text-foreground">{{ props.chapterTitle }}</h2>
            <div class="w-16 h-1 bg-primary/20 rounded mt-2"></div>
          </div>

          <p
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            class="mb-6 last:mb-0 text-foreground"
          >
            {{ paragraph }}
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
