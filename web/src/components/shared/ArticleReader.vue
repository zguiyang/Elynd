<script setup lang="ts">
import {
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  ChevronDown,
} from 'lucide-vue-next'
import { useReadingSettingsStore } from '@/stores/reading-settings'
import type { LineHeight, ContentWidth } from '@/stores/reading-settings'

interface Props {
  title: string
  paragraphs: string[]
  currentPage: number
  totalPages: number
  difficulty?: string
  category?: string
  wordDefinitions?: Record<string, { en: string; zh: string }>
}

interface Emits {
  (e: 'update:currentPage', page: number): void
  (e: 'word-click', word: string): void
}

const props = withDefaults(defineProps<Props>(), {
  difficulty: undefined,
  category: undefined,
  wordDefinitions: () => ({}),
})

const emit = defineEmits<Emits>()

const readingSettings = useReadingSettingsStore()

const selectedWord = ref<string | null>(null)
const wordPosition = ref({ x: 0, y: 0 })

const lineHeightOptions: { value: LineHeight; label: string }[] = [
  { value: 'compact', label: '紧凑' },
  { value: 'normal', label: '标准' },
  { value: 'relaxed', label: '宽松' },
]

const contentWidthOptions: { value: ContentWidth; label: string }[] = [
  { value: 'narrow', label: '窄' },
  { value: 'medium', label: '中' },
  { value: 'wide', label: '宽' },
]

const lineHeightLabel = computed(
  () => lineHeightOptions.find((opt) => opt.value === readingSettings.lineHeight)?.label ?? '标准'
)

const contentWidthLabel = computed(
  () => contentWidthOptions.find((opt) => opt.value === readingSettings.contentWidth)?.label ?? '中'
)

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

const goToPreviousPage = () => {
  if (props.currentPage > 1) {
    emit('update:currentPage', props.currentPage - 1)
  }
}

const goToNextPage = () => {
  if (props.currentPage < props.totalPages) {
    emit('update:currentPage', props.currentPage + 1)
  }
}

const splitIntoWords = (paragraph: string) => {
  return paragraph.split(/(\s+)/)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold">{{ title }}</h1>
        <Badge v-if="difficulty" variant="default">
          {{ difficulty }}
        </Badge>
        <Badge v-if="category" variant="outline">
          {{ category }}
        </Badge>
      </div>
    </div>

    <Card>
      <CardContent class="flex items-center justify-between flex-wrap gap-4 py-3">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              class="size-8"
              @click="readingSettings.decrementFontSize"
            >
              <Minus class="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              class="size-8"
              @click="readingSettings.incrementFontSize"
            >
              <Plus class="size-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="sm" class="gap-1">
                行高: {{ lineHeightLabel }}
                <ChevronDown class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                v-for="option in lineHeightOptions"
                :key="option.value"
                @click="readingSettings.setLineHeight(option.value)"
              >
                {{ option.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="sm" class="gap-1">
                宽度: {{ contentWidthLabel }}
                <ChevronDown class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                v-for="option in contentWidthOptions"
                :key="option.value"
                @click="readingSettings.setContentWidth(option.value)"
              >
                {{ option.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div class="text-sm text-muted-foreground">
          第 {{ currentPage }} 页 / 共 {{ totalPages }} 页
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="py-8">
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

    <div class="flex items-center justify-center gap-4">
      <Button
        variant="outline"
        :disabled="currentPage <= 1"
        @click="goToPreviousPage"
      >
        <ChevronLeft class="size-4 mr-1" />
        上一页
      </Button>
      <Button
        variant="outline"
        :disabled="currentPage >= totalPages"
        @click="goToNextPage"
      >
        下一页
        <ChevronRight class="size-4 ml-1" />
      </Button>
    </div>

    <div
      v-if="selectedWord && wordDefinitions[selectedWord]"
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
            {{ wordDefinitions[selectedWord]?.en }}
          </p>
          <p class="text-sm text-muted-foreground mt-1">
            <span class="font-medium">中:</span>
            {{ wordDefinitions[selectedWord]?.zh }}
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
