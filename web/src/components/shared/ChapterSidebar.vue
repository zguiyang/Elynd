<script setup lang="ts">
import type { ChapterListItem } from '@/types/article'

interface Props {
  chapters: ChapterListItem[]
  currentIndex: number
  isPlaying?: boolean
  currentTime?: number
  duration?: number
}

interface Emits {
  (e: 'select', index: number): void
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'replay'): void
  (e: 'seek', time: number): void
}

const props = withDefaults(defineProps<Props>(), {
  isPlaying: false,
  currentTime: 0,
  duration: 180,
})

const emit = defineEmits<Emits>()

const handleSelect = (index: number) => {
  emit('select', index)
}

const handlePlay = () => {
  emit('play')
}

const handlePause = () => {
  emit('pause')
}

const handleReplay = () => {
  emit('replay')
}

const handleSeek = (time: number) => {
  emit('seek', time)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 min-h-0 overflow-y-auto p-4">
      <h2 class="font-semibold text-sm text-muted-foreground mb-3">目录</h2>
      <ChapterTocList
        :chapters="props.chapters"
        :current-index="props.currentIndex"
        @select="handleSelect"
      />
    </div>

    <div class="flex-none border-t bg-muted/50 p-3">
      <AudioPlayer
        variant="full"
        :is-playing="props.isPlaying"
        :current-time="props.currentTime"
        :duration="props.duration"
        @play="handlePlay"
        @pause="handlePause"
        @replay="handleReplay"
        @seek="handleSeek"
      />
    </div>
  </div>
</template>
