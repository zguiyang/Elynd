<script setup lang="ts">
import { ArrowLeft, Menu, BookOpen } from 'lucide-vue-next'
import { useArticle } from '@/composables/useArticle'
import { learningApi } from '@/api/learning'
import AiChatPanel from '@/components/shared/AiChatPanel.vue'
import type { ChapterListItem } from '@/types/article'
import { toast } from 'vue-sonner'

const route = useRoute()
const articleId = Number(route.params.id)

const { article, fetchArticle } = useArticle()

const currentChapterIndex = ref(0)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const audioRef = ref<HTMLAudioElement | null>(null)
const isAudioLoading = ref(false)
const audioError = ref<string | null>(null)

const isMobileTocOpen = ref(false)
const showAiChat = ref(false)

const startTime = ref<number | null>(null)
const lastSavedProgress = ref(0)
const isProgressUpdatePending = ref(false)

const PROGRESS_UPDATE_INTERVAL = 30000

const chapters = computed<ChapterListItem[]>(() => article.value?.chapters ?? [])
const totalChapters = computed(() => chapters.value.length)

const currentProgress = computed(() => {
  if (!totalChapters.value) return 0
  const chapterProgress = (currentChapterIndex.value / totalChapters.value) * 100
  const timeProgress = duration.value > 0 ? (currentTime.value / duration.value) * (1 / totalChapters.value) * 100 : 0
  return Math.min(Math.round(chapterProgress + timeProgress), 100)
})

const audioSrc = computed(() => {
  if (!article.value?.audioUrl) return null
  const baseUrl = import.meta.env.VITE_TTS_BASE_URL
  return `${baseUrl}/${article.value.audioUrl}`
})

const canPlayAudio = computed(() => {
  return article.value?.audioStatus === 'completed' && article.value?.audioUrl
})

const updateReadingProgress = async (progress: number) => {
  if (progress === lastSavedProgress.value || isProgressUpdatePending.value) return

  isProgressUpdatePending.value = true
  try {
    await learningApi.updateProgress(articleId, progress)
    lastSavedProgress.value = progress
  } catch (e) {
    console.error('Failed to update reading progress:', e)
  } finally {
    isProgressUpdatePending.value = false
  }
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

const handleChapterSelect = (index: number) => {
  currentChapterIndex.value = index
}

const handleMobileChapterSelect = (index: number) => {
  currentChapterIndex.value = index
  isMobileTocOpen.value = false
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

const getDifficultyVariant = (difficulty: string): 'default' | 'secondary' | 'outline' => {
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    L1: 'secondary',
    L2: 'default',
    L3: 'outline',
  }
  return variants[difficulty] || 'secondary'
}

onMounted(() => {
  fetchArticle(articleId)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', stopProgressTracking)
})

onUnmounted(() => {
  stopProgressTracking()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('beforeunload', stopProgressTracking)
})

watch(article, (newArticle) => {
  if (newArticle && newArticle.chapters) {
    startProgressTracking()
  }
}, { immediate: true })
</script>

<template>
  <div class="h-dvh flex flex-col bg-background">
    <header class="h-14 flex-none border-b bg-background/95 backdrop-blur flex items-center px-4 gap-3">
      <Button variant="ghost" size="icon" as-child>
        <RouterLink to="/learning/articles">
          <ArrowLeft class="size-5" />
        </RouterLink>
      </Button>

      <h1 class="text-lg font-semibold truncate flex-1 min-w-0">
        {{ article?.title ?? 'Loading...' }}
      </h1>

      <template v-if="article">
        <Badge v-if="article.difficultyLevel" :variant="getDifficultyVariant(article.difficultyLevel)">
          {{ article.difficultyLevel }}
        </Badge>
        <Badge
          v-for="tag in article.tags.slice(0, 2)"
          :key="tag.id"
          variant="outline"
          class="hidden sm:inline-flex"
        >
          {{ tag.name }}
        </Badge>

        <Button
          variant="outline"
          size="sm"
          class="gap-2 hidden md:inline-flex"
          as-child
        >
          <RouterLink :to="`/learning/article/${articleId}/vocabulary`">
            <BookOpen class="size-4" />
            词汇
          </RouterLink>
        </Button>
      </template>

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
      <aside v-if="article" class="hidden md:flex w-60 flex-col border-r bg-muted/30">
        <ChapterSidebar
          :chapters="chapters"
          :current-index="currentChapterIndex"
          :is-playing="isPlaying"
          :current-time="currentTime"
          :duration="duration"
          :audio-status="article.audioStatus"
          @select="handleChapterSelect"
          @play="handlePlay"
          @pause="handlePause"
          @replay="handleReplay"
          @seek="handleSeek"
        />
      </aside>

      <main class="flex-1 min-h-0 overflow-auto">
        <router-view
          :article="article"
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
      v-model:open="showAiChat"
      :article-id="articleId"
      :article-title="article?.title ?? ''"
      :chapter-content="(chapters[currentChapterIndex] as ChapterListItem & { content?: string })?.content"
    />
  </div>
</template>
