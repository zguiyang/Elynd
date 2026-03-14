 <script setup lang="ts">
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
} from 'lucide-vue-next'
import { useReadingSettingsStore } from '@/stores/reading-settings'
import { bookApi } from '@/api/book'
import type { LineHeight, ContentWidth } from '@/stores/reading-settings'
import type { Book, Chapter, VocabularyItem } from '@/types/book'
import VocabularyPreview from '@/components/shared/VocabularyPreview.vue'
import { toast } from 'vue-sonner'

interface Props {
  book?: Book | null
  chapter?: Chapter | null
  chapterLoading?: boolean
  chapterError?: string | null
  currentChapterIndex?: number
  isPlaying?: boolean
  currentTime?: number
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  book: null,
  chapter: null,
  chapterLoading: false,
  chapterError: null,
  currentChapterIndex: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 180,
})

const emit = defineEmits<{
  (e: 'update:currentChapterIndex', index: number): void
  (e: 'update:isPlaying', value: boolean): void
  (e: 'update:currentTime', value: number): void
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'replay'): void
  (e: 'seek', time: number): void
}>()

const route = useRoute()
const bookId = Number(route.params.id)

const readingSettings = useReadingSettingsStore()

const showVocabulary = ref(false)
const vocabularies = ref<VocabularyItem[]>([])
const isLoadingVocabulary = ref(false)

const lineHeightOptions: { value: LineHeight; label: string }[] = [
  { value: 'compact', label: '紧凑' },
  { value: 'normal', label: '标准' },
  { value: 'relaxed', label: '宽松' },
]

const contentWidthOptions: { value: ContentWidth; label: string }[] = [
  { value: 'full', label: '充满' },
  { value: 'medium', label: '居中' },
]

const totalChapters = computed(() => props.book?.chapters.length ?? 0)

const paragraphs = computed(() => {
  if (!props.chapter?.content) return []
  return props.chapter.content.split('\n\n').filter((p) => p.trim())
})

const markdownContent = computed(() => {
  if (!props.chapter?.content) {
    return ''
  }

  const title = props.chapter.title?.trim() || 'Untitled Chapter'
  return `# ${title}\n\n${props.chapter.content}`
})

const goToPreviousChapter = () => {
  if (props.currentChapterIndex > 0) {
    const newIndex = props.currentChapterIndex - 1
    emit('update:currentChapterIndex', newIndex)
  }
}

const goToNextChapter = () => {
  if (props.currentChapterIndex < totalChapters.value - 1) {
    const newIndex = props.currentChapterIndex + 1
    emit('update:currentChapterIndex', newIndex)
  }
}

const togglePlay = () => {
  emit('update:isPlaying', !props.isPlaying)
  if (props.isPlaying) {
    emit('pause')
  } else {
    emit('play')
  }
}

const replay = () => {
  emit('update:currentTime', 0)
  emit('replay')
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const fetchVocabulary = async () => {
  if (vocabularies.value.length > 0) {
    showVocabulary.value = true
    return
  }

  isLoadingVocabulary.value = true
  await bookApi.getVocabulary(bookId)
    .then((res) => {
      vocabularies.value = res
      showVocabulary.value = true
    })
    .catch(() => {
      toast.error('获取词汇失败')
    })
    .finally(() => {
      isLoadingVocabulary.value = false
    })
}

defineExpose({
  fetchVocabulary,
})
</script>

<template>
  <div class="h-full flex flex-col relative">
    <div class="flex-1 min-h-0 overflow-auto px-4 py-6">
      <div v-if="props.chapterLoading" class="flex items-center justify-center h-full">
        <Loader2 class="size-8 animate-spin text-muted-foreground" />
      </div>

      <div v-else-if="props.chapterError" class="flex items-center justify-center h-full">
        <div class="text-center">
          <p class="text-destructive mb-4">{{ props.chapterError }}</p>
        </div>
      </div>

      <BookReader
        v-else-if="props.chapter"
        :paragraphs="paragraphs"
        :chapter-title="props.chapter?.title"
        :markdown-content="markdownContent"
      />
    </div>

    <div class="md:hidden flex-none border-t bg-background">
      <div class="flex items-center justify-between px-3 py-2 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="h-8 gap-1 text-xs">
              字号 {{ readingSettings.fontSize }}
              <ChevronDown class="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              v-for="opt in readingSettings.fontSizeOptions"
              :key="opt.value"
              @click="readingSettings.setFontSize(opt.value)"
            >
              {{ opt.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="h-8 gap-1 text-xs">
              行高
              <ChevronDown class="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              v-for="opt in lineHeightOptions"
              :key="opt.value"
              @click="readingSettings.setLineHeight(opt.value)"
            >
              {{ opt.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="h-8 gap-1 text-xs">
              宽度
              <ChevronDown class="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              v-for="opt in contentWidthOptions"
              :key="opt.value"
              @click="readingSettings.setContentWidth(opt.value)"
            >
              {{ opt.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div class="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            class="size-8"
            :disabled="props.currentChapterIndex <= 0"
            @click="goToPreviousChapter"
          >
            <ChevronLeft class="size-4" />
          </Button>
          <span class="text-xs text-muted-foreground min-w-12 text-center">
            {{ props.currentChapterIndex + 1 }} / {{ totalChapters }}
          </span>
          <Button
            variant="outline"
            size="icon"
            class="size-8"
            :disabled="props.currentChapterIndex >= totalChapters - 1"
            @click="goToNextChapter"
          >
            <ChevronRight class="size-4" />
          </Button>
        </div>
      </div>

      <div class="flex items-center gap-3 h-14 border-t">
        <Button size="icon" class="size-8 shrink-0 ml-4" @click="togglePlay">
          <Play v-if="!props.isPlaying" class="size-4" />
          <Pause v-else class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" class="size-7 shrink-0" @click="replay">
          <RotateCcw class="size-3.5" />
        </Button>
        <Volume2 class="size-4 text-muted-foreground shrink-0" />
        <div class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            class="h-full bg-primary rounded-full transition-all"
            :style="{ width: `${(props.currentTime / props.duration) * 100}%` }"
          />
        </div>
        <span class="text-xs text-muted-foreground shrink-0 mr-4">{{ formatTime(props.currentTime) }}</span>
      </div>
    </div>

    <Dialog v-model:open="showVocabulary">
      <DialogContent class="max-w-lg">
        <VocabularyPreview :vocabularies="vocabularies" @close="showVocabulary = false" />
      </DialogContent>
    </Dialog>
  </div>
</template>
