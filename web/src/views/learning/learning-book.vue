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
  Languages,
} from 'lucide-vue-next'
import { useReadingSettingsStore } from '@/stores/reading-settings'
import { bookApi } from '@/api/book'
import { createChapterTranslationStream } from '@/api/chapter-translation'
import { userApi } from '@/api/user'
import type { LineHeight, ContentWidth } from '@/stores/reading-settings'
import type { ReaderAiActionRequest, ReaderSelectionActionPayload } from '@/types/reader-selection'
import type {
  Book,
  Chapter,
  VocabularyItem,
  ChapterTranslationResult,
  ChapterTranslationStatus,
} from '@/types/book'
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
  (e: 'reader-ai-action', payload: ReaderAiActionRequest): void
}>()

const route = useRoute()
const bookId = Number(route.params.id)

const readingSettings = useReadingSettingsStore()

const showVocabulary = ref(false)
const vocabularies = ref<VocabularyItem[]>([])
const isLoadingVocabulary = ref(false)
const showTranslation = ref(false)
const translationStatus = ref<'idle' | ChapterTranslationStatus>('idle')
const translationId = ref<number | null>(null)
const translationResult = ref<ChapterTranslationResult | null>(null)
const translationError = ref<string | null>(null)
const languageConfig = ref<{ sourceLanguage: string; targetLanguage: string } | null>(null)
let translationStreamHandle: { close: () => void } | null = null
let translationFallbackTimer: ReturnType<typeof setInterval> | null = null

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

const translationButtonLabel = computed(() => {
  if (translationStatus.value === 'queued' || translationStatus.value === 'processing') {
    return '翻译中...'
  }
  if (translationResult.value && showTranslation.value) {
    return '隐藏翻译'
  }
  if (translationResult.value) {
    return '显示翻译'
  }
  if (translationStatus.value === 'failed') {
    return '重试翻译'
  }
  return '翻译'
})

const isTranslating = computed(() => {
  return translationStatus.value === 'queued' || translationStatus.value === 'processing'
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

const clearTranslationStream = () => {
  if (translationStreamHandle) {
    translationStreamHandle.close()
    translationStreamHandle = null
  }
}

const clearTranslationFallbackPolling = () => {
  if (translationFallbackTimer) {
    clearInterval(translationFallbackTimer)
    translationFallbackTimer = null
  }
}

const resetTranslationState = () => {
  clearTranslationStream()
  clearTranslationFallbackPolling()
  showTranslation.value = false
  translationStatus.value = 'idle'
  translationId.value = null
  translationResult.value = null
  translationError.value = null
}

const ensureLanguageConfig = async () => {
  if (languageConfig.value) {
    return languageConfig.value
  }

  const config = await userApi.getConfig()
  languageConfig.value = {
    sourceLanguage: config.targetLanguage || 'en',
    targetLanguage: config.nativeLanguage || 'zh',
  }
  return languageConfig.value
}

const getNativeLanguageCode = async () => {
  const lang = await ensureLanguageConfig()
  return lang.targetLanguage || 'zh'
}

const handleReaderSelectionAction = (payload: ReaderSelectionActionPayload) => {
  if (payload.actionType === 'lookup') {
    return
  }
  emit('reader-ai-action', {
    actionType: payload.actionType,
    selectedText: payload.selectedText,
    chapterIndex: props.currentChapterIndex,
  })
}

const refreshChapterTranslation = async () => {
  if (!props.chapter?.id) {
    return
  }

  const lang = await ensureLanguageConfig()
  const result = await bookApi.getChapterTranslation(props.chapter.id, {
    sourceLanguage: lang.sourceLanguage,
    targetLanguage: lang.targetLanguage,
  })

  if (result.status === 'completed' && result.data) {
    translationStatus.value = 'completed'
    translationResult.value = result.data
    showTranslation.value = true
    if (result.translationId) {
      translationId.value = result.translationId
    }
  } else {
    translationStatus.value = result.status
    translationId.value = result.translationId
  }
}

const startTranslationPolling = () => {
  clearTranslationFallbackPolling()
  if (!translationId.value) {
    return
  }

  translationFallbackTimer = setInterval(async () => {
    if (!translationId.value) {
      clearTranslationFallbackPolling()
      return
    }

    try {
      const statusRes = await bookApi.getChapterTranslationStatus(translationId.value)
      translationStatus.value = statusRes.status

      if (statusRes.status === 'completed') {
        await refreshChapterTranslation()
        clearTranslationFallbackPolling()
        clearTranslationStream()
      } else if (statusRes.status === 'failed') {
        translationError.value = statusRes.errorMessage || '翻译失败，请稍后重试'
        clearTranslationFallbackPolling()
        clearTranslationStream()
      }
    } catch {
      translationError.value = '翻译状态获取失败'
      clearTranslationFallbackPolling()
    }
  }, 2000)
}

const startTranslationStream = () => {
  clearTranslationStream()
  if (!translationId.value) {
    return
  }

  translationStreamHandle = createChapterTranslationStream(translationId.value, {
    onStatus: async (payload) => {
      translationStatus.value = payload.status

      if (payload.status === 'completed') {
        await refreshChapterTranslation()
        clearTranslationStream()
        clearTranslationFallbackPolling()
        return
      }

      if (payload.status === 'failed') {
        translationError.value = payload.errorMessage || '翻译失败，请稍后重试'
        clearTranslationStream()
        clearTranslationFallbackPolling()
      }
    },
    onError: () => {
      clearTranslationStream()
      startTranslationPolling()
    },
  })
}

const trackTranslationTask = async () => {
  if (!translationId.value) {
    return
  }

  try {
    // Initial compensation: sync status once after page load / task attach.
    const statusRes = await bookApi.getChapterTranslationStatus(translationId.value)
    translationStatus.value = statusRes.status

    if (statusRes.status === 'completed') {
      await refreshChapterTranslation()
      return
    }

    if (statusRes.status === 'failed') {
      translationError.value = statusRes.errorMessage || '翻译失败，请稍后重试'
      return
    }
  } catch {
    startTranslationPolling()
    return
  }

  startTranslationStream()
}

const triggerTranslation = async () => {
  if (!props.chapter?.id || isTranslating.value) {
    return
  }

  if (translationResult.value) {
    showTranslation.value = !showTranslation.value
    return
  }

  translationError.value = null
  translationStatus.value = 'queued'

  try {
    const lang = await ensureLanguageConfig()
    const result = await bookApi.triggerChapterTranslation(props.chapter.id, {
      sourceLanguage: lang.sourceLanguage,
      targetLanguage: lang.targetLanguage,
    })

    translationStatus.value = result.status
    translationId.value = result.translationId

    if (result.status === 'completed' && result.data) {
      translationResult.value = result.data
      showTranslation.value = true
      return
    }

    if (result.status === 'queued' || result.status === 'processing') {
      await trackTranslationTask()
      return
    }

    if (result.status === 'failed') {
      translationError.value = '翻译失败，请稍后重试'
    }
  } catch {
    translationStatus.value = 'failed'
    translationError.value = '翻译请求失败，请稍后重试'
    toast.error('翻译请求失败')
  }
}

defineExpose({
  fetchVocabulary,
})

watch(
  () => props.chapter?.id,
  () => {
    resetTranslationState()
  }
)

onUnmounted(() => {
  clearTranslationStream()
  clearTranslationFallbackPolling()
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

      <div v-else-if="props.chapter" class="mx-auto w-full py-4" :style="{ maxWidth: readingSettings.contentWidthCss }">
        <div class="mb-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-8 gap-2 text-xs"
            :disabled="isTranslating"
            @click="triggerTranslation"
          >
            <Languages class="size-3.5" />
            {{ translationButtonLabel }}
          </Button>
        </div>

        <p v-if="translationError" class="mb-4 text-xs text-destructive">
          {{ translationError }}
        </p>

        <div v-if="showTranslation && translationResult" class="space-y-6">
          <div>
            <h2 class="text-xl font-semibold text-foreground">
              {{ translationResult.title.original }}
            </h2>
            <p
              v-if="translationResult.title.translated"
              class="mt-1 text-sm leading-6 text-muted-foreground"
            >
              {{ translationResult.title.translated }}
            </p>
          </div>

          <div
            v-for="paragraph in translationResult.paragraphs"
            :key="paragraph.paragraphIndex"
            class="space-y-4"
          >
            <div
              v-for="sentence in paragraph.sentences"
              :key="`${paragraph.paragraphIndex}-${sentence.sentenceIndex}`"
              class="rounded-lg border bg-card/50 p-3"
            >
              <p class="text-sm leading-7 text-foreground">
                {{ sentence.original }}
              </p>
              <p v-if="sentence.translated" class="mt-1 text-sm leading-7 text-muted-foreground">
                {{ sentence.translated }}
              </p>
            </div>
          </div>
        </div>

        <BookReader
          v-else
          :paragraphs="paragraphs"
          :chapter-title="props.chapter?.title"
          :markdown-content="markdownContent"
          :book-id="bookId"
          :chapter-index="props.currentChapterIndex"
          @selection-action="handleReaderSelectionAction"
        />
      </div>
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
            data-test="reader-prev-chapter"
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
            data-test="reader-next-chapter"
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
        <Button data-test="reader-toggle-play" size="icon" class="size-8 shrink-0 ml-4" @click="togglePlay">
          <Play v-if="!props.isPlaying" class="size-4" />
          <Pause v-else class="size-4" />
        </Button>
        <Button data-test="reader-replay" variant="ghost" size="icon" class="size-7 shrink-0" @click="replay">
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
