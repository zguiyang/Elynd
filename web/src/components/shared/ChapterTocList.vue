<script setup lang="ts">
import type { ChapterListItem } from '@/types/book'

interface Props {
  chapters: ChapterListItem[]
  currentIndex: number
}

interface Emits {
  (e: 'select', index: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleSelect = (index: number) => {
  emit('select', index)
}
</script>

<template>
  <nav class="space-y-1">
    <button
      v-for="(chapter, index) in props.chapters"
      :key="chapter.id"
      type="button"
      class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
      :class="[
        index === props.currentIndex
          ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
          : 'hover:bg-muted text-muted-foreground hover:text-foreground',
      ]"
      @click="handleSelect(index)"
    >
      {{ chapter.title }}
    </button>
  </nav>
</template>
