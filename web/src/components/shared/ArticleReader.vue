<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useReadingSettingsStore } from '@/stores/reading-settings'

interface Props {
  paragraphs: string[]
  wordDefinitions?: Record<string, { en: string; zh: string }>
}

interface Emits {
  (e: 'word-click', word: string): void
}

const props = withDefaults(defineProps<Props>(), {
  wordDefinitions: () => ({}),
})

const emit = defineEmits<Emits>()

const readingSettings = useReadingSettingsStore()

const selectedWord = ref<string | null>(null)
const wordPosition = ref({ x: 0, y: 0 })

const contentStyle = computed(() => ({
  fontSize: readingSettings.fontSizeCss,
  lineHeight: readingSettings.lineHeightCss,
}))

const handleWordClick = (event: MouseEvent, word: string) => {
  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()
  wordPosition.value = {
    x: rect.left + rect.width / 2,
    y: rect.top - 10,
  }
  selectedWord.value = word.toLowerCase().replace(/[.,!?;:'"]/g, '')
  emit('word-click', selectedWord.value)
}

const closeWordPopup = () => {
  selectedWord.value = null
}

const splitIntoWords = (paragraph: string) => {
  return paragraph.split(/(\s+)/)
}
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
          <p
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            class="mb-6 last:mb-0"
          >
            <span
              v-for="(word, wordIndex) in splitIntoWords(paragraph)"
              :key="wordIndex"
              :class="[
                /^\s+$/.test(word)
                  ? ''
                  : 'cursor-pointer hover:text-primary transition-colors',
              ]"
              @click="!/^\s+$/.test(word) && handleWordClick($event, word)"
            >
              {{ word }}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>

    <div
      v-if="selectedWord && props.wordDefinitions[selectedWord]"
      class="fixed z-50"
      :style="{
        left: `${wordPosition.x}px`,
        top: `${wordPosition.y}px`,
        transform: 'translate(-50%, -100%)',
      }"
    >
      <Card class="shadow-lg min-w-48">
        <CardHeader class="pb-2">
          <div class="flex items-center justify-between">
            <CardTitle class="text-base capitalize">{{ selectedWord }}</CardTitle>
            <Button variant="ghost" size="icon" class="size-6" @click="closeWordPopup">
              <X class="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent class="pt-0">
          <p class="text-sm">
            <span class="font-medium">EN:</span>
            {{ props.wordDefinitions[selectedWord]?.en }}
          </p>
          <p class="text-sm text-muted-foreground mt-1">
            <span class="font-medium">中:</span>
            {{ props.wordDefinitions[selectedWord]?.zh }}
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
