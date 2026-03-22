<script setup lang="ts">
import { ArrowLeft, Menu, BookOpen, ChevronDown, Bot } from 'lucide-vue-next'
import { useBook, useChapter } from '@/composables/useBook'
import { useReadingSettingsStore } from '@/stores/reading-settings'
import { learningApi } from '@/api/learning'
import AiChatPanel from '@/components/shared/AiChatPanel.vue'
import type { ReaderAiActionRequest } from '@/types/reader-selection'
import type { ChapterListItem } from '@/types/book'
import { formatBookLevelRange } from '@/lib/book-level'
import { toast } from 'vue-sonner'

const route = useRoute()
const bookId = Number(route.params.id)

const { book, fetchBook } = useBook()
const { chapter, isLoading: chapterLoading, error: chapterError, fetchChapter } = useChapter()
const readingSettings = useReadingSettingsStore()

const currentChapterIndex = ref(0)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const audioRef = ref<HTMLAudioElement | null>(null)
const isAudioLoading = ref(false)
const audioError = ref<string | null>(null)

const isMobileTocOpen = ref(false)
const showAiChat = ref(false)
const aiChatPanelRef = ref<{
  openAndSend: (payload: {
    content: string
    actionType?: 'explain' | 'qa' | 'translate'
    chapterIndex?: number
  }) => void
} | null>(null)

const startTime = ref<number | null>(null)
const lastSavedProgress = ref(0)
const isProgressUpdatePending = ref(false)

const PROGRESS_UPDATE_INTERVAL = 30000

const chapters = computed<ChapterListItem[]>(() => book.value?.chapters ?? [])
const totalChapters = computed(() => chapters.value.length)

const currentProgress = computed(() => {
  if (!totalChapters.value) return 0
  const chapterProgress = (currentChapterIndex.value / totalChapters.value) * 100
  const timeProgress = duration.value > 0 ? (currentTime.value / duration.value) * (1 / totalChapters.value) * 100 : 0
  return Math.min(Math.round(chapterProgress + timeProgress), 100)
})

const audioSrc = computed(() => {
  if (!chapter.value?.audioUrl) return null
  const baseUrl = import.meta.env.VITE_TTS_BASE_URL
  return `${baseUrl}/${chapter.value.audioUrl}`
})

const canPlayAudio = computed(() => {
  return chapter.value?.audioStatus === 'completed' && chapter.value?.audioUrl
})

const updateReadingProgress = async (progress: number) => {
  if (progress === lastSavedProgress.value || isProgressUpdatePending.value) return

  isProgressUpdatePending.value = true
  await learningApi.updateProgress(bookId, progress)
    .then(() => {
      lastSavedProgress.value = progress
    })
    .catch(() => {
      console.error('Failed to update reading progress')
    })
    .finally(() => {
      isProgressUpdatePending.value = false
    })
}

let progressTimer: ReturnType<typeof setInterval> | null = null

const startProgressTracking = () => {
  if (progressTimer) return

  startTime.value = Date.now()
  progressTimer = setInterval(() => {
    const progress = currentProgress.value
    if (progress > lastSavedProgress.value) {
      updateReadingProgress(progress)
    }
  }, PROGRESS_UPDATE_INTERVAL)
}

const stopProgressTracking = () => {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }

  const finalProgress = currentProgress.value
  if (finalProgress > lastSavedProgress.value) {
    updateReadingProgress(finalProgress)
  }
}

const handleVisibilityChange = () => {
  if (document.hidden) {
    const progress = currentProgress.value
    if (progress > lastSavedProgress.value) {
      updateReadingProgress(progress)
    }
  } else {
    startProgressTracking()
  }
}

const handleChapterSelect = async (index: number) => {
  currentChapterIndex.value = index
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  audioError.value = null
  await fetchChapter(bookId, index)
}

const handleMobileChapterSelect = async (index: number) => {
  currentChapterIndex.value = index
  isMobileTocOpen.value = false
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  audioError.value = null
  await fetchChapter(bookId, index)
}

const handlePlay = () => {
  if (audioRef.value && canPlayAudio.value) {
    audioRef.value.play()
    isPlaying.value = true
  }
}

const handlePause = () => {
  if (audioRef.value) {
    audioRef.value.pause()
    isPlaying.value = false
  }
}

const handleReplay = () => {
  if (audioRef.value) {
    audioRef.value.currentTime = 0
    audioRef.value.play()
    isPlaying.value = true
  }
}

const handleSeek = (time: number) => {
  if (audioRef.value) {
    audioRef.value.currentTime = time
    currentTime.value = time
  }
}

const handleTimeUpdate = () => {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

const handleLoadedMetadata = () => {
  if (audioRef.value) {
    duration.value = audioRef.value.duration
    isAudioLoading.value = false
  }
}

const handleAudioError = () => {
  if (audioRef.value?.error) {
    audioError.value = '音频加载失败'
    toast.error('音频加载失败')
  }
  isAudioLoading.value = false
  isPlaying.value = false
}

const handleAudioEnded = () => {
  isPlaying.value = false
}

const handleAudioCanPlay = () => {
  isAudioLoading.value = false
}

const getLevelVariant = (sortOrder: number): 'default' | 'secondary' | 'outline' => {
  if (sortOrder === 1) return 'secondary'
  if (sortOrder === 2) return 'default'
  return 'outline'
}

const handleReaderAiAction = (payload: ReaderAiActionRequest) => {
  showAiChat.value = true
  aiChatPanelRef.value?.openAndSend({
    content: payload.selectedText,
    actionType: payload.actionType,
    chapterIndex: payload.chapterIndex,
  })
}

onMounted(async () => {
  await fetchBook(bookId)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', stopProgressTracking)
})

onUnmounted(() => {
  stopProgressTracking()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('beforeunload', stopProgressTracking)
})

watch(book, (newBook) => {
  if (newBook && newBook.chapters && newBook.chapters.length > 0) {
    startProgressTracking()
    // 自动加载第一章
    fetchChapter(bookId, 0)
  }
}, { immediate: true })
</script>

<template>
  <div class="h-dvh flex flex-col bg-background">
    <header class="h-14 flex-none border-b bg-background/95 backdrop-blur flex items-center px-4 gap-3">
      <Button variant="ghost" size="icon" as-child>
        <RouterLink to="/learning/books">
          <ArrowLeft class="size-5" />
        </RouterLink>
      </Button>

      <h1 class="text-lg font-semibold truncate flex-1 min-w-0">
        {{ book?.title ?? 'Loading...' }}
      </h1>

      <template v-if="book">
        <Badge v-if="book.level" :variant="getLevelVariant(book.level.sortOrder)">
          {{ formatBookLevelRange(book.level) }}
        </Badge>
        <Badge
          v-for="tag in book.tags.slice(0, 2)"
          :key="tag.id"
          variant="outline"
          class="hidden sm:inline-flex"
        >
          {{ tag.name }}
        </Badge>

        <div class="hidden md:flex items-center gap-2">
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
              <DropdownMenuItem @click="readingSettings.setLineHeight('compact')">
                紧凑
              </DropdownMenuItem>
              <DropdownMenuItem @click="readingSettings.setLineHeight('normal')">
                标准
              </DropdownMenuItem>
              <DropdownMenuItem @click="readingSettings.setLineHeight('relaxed')">
                宽松
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
              <DropdownMenuItem @click="readingSettings.setContentWidth('full')">
                充满
              </DropdownMenuItem>
              <DropdownMenuItem @click="readingSettings.setContentWidth('medium')">
                居中
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          variant="outline"
          size="sm"
          class="gap-2 hidden md:inline-flex"
          as-child
        >
          <RouterLink :to="`/learning/book/${bookId}/vocabulary`">
            <BookOpen class="size-4" />
            词汇
          </RouterLink>
        </Button>

        <Button
          variant="default"
          size="sm"
          class="gap-2 hidden md:inline-flex"
          @click="showAiChat = true"
        >
          <Bot class="size-4" />
          AI 助手
        </Button>
      </template>

      <Button
        variant="ghost"
        size="icon"
        class="md:hidden shrink-0"
        @click="showAiChat = true"
      >
        <Bot class="size-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        class="md:hidden shrink-0"
        @click="isMobileTocOpen = true"
      >
        <Menu class="size-5" />
      </Button>
    </header>

    <div class="flex-1 min-h-0 flex">
      <aside v-if="book" class="hidden md:flex w-60 flex-col border-r bg-muted/20">
        <ChapterSidebar
          :chapters="chapters"
          :current-index="currentChapterIndex"
          :is-playing="isPlaying"
          :current-time="currentTime"
          :duration="duration"
          :audio-status="chapter?.audioStatus ?? null"
          @select="handleChapterSelect"
          @play="handlePlay"
          @pause="handlePause"
          @replay="handleReplay"
          @seek="handleSeek"
        />
      </aside>

      <main class="flex-1 min-h-0 overflow-auto">
        <router-view
          :book="book"
          :chapter="chapter"
          :chapter-loading="chapterLoading"
          :chapter-error="chapterError"
          :current-chapter-index="currentChapterIndex"
          :is-playing="isPlaying"
          :current-time="currentTime"
          :duration="duration"
          @update:current-chapter-index="currentChapterIndex = $event"
          @update:is-playing="isPlaying = $event"
          @update:current-time="currentTime = $event"
          @play="handlePlay"
          @pause="handlePause"
          @replay="handleReplay"
          @seek="handleSeek"
          @reader-ai-action="handleReaderAiAction"
        />
      </main>

      <audio
        ref="audioRef"
        :src="audioSrc ?? undefined"
        preload="metadata"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @error="handleAudioError"
        @ended="handleAudioEnded"
        @canplay="handleAudioCanPlay"
      />
    </div>

    <Sheet :open="isMobileTocOpen" @update:open="isMobileTocOpen = $event">
      <SheetContent side="left" class="w-72">
        <SheetHeader>
          <SheetTitle>目录</SheetTitle>
        </SheetHeader>
        <div class="mt-4">
          <ChapterTocList
            :chapters="chapters"
            :current-index="currentChapterIndex"
            @select="handleMobileChapterSelect"
          />
        </div>
      </SheetContent>
    </Sheet>

    <AiChatPanel
      ref="aiChatPanelRef"
      v-model:open="showAiChat"
      :book-id="bookId"
      :book-title="book?.title ?? ''"
      :chapter-content="chapter?.content ?? ''"
      :chapter-index="currentChapterIndex"
    />
  </div>
</template>
