<script setup lang="ts">
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Bot,
} from 'lucide-vue-next'
import { useReadingSettingsStore } from '@/stores/reading-settings'
import { useChapter } from '@/composables/useArticle'
import { articleApi } from '@/api/article'
import type { LineHeight, ContentWidth } from '@/stores/reading-settings'
import type { Article, VocabularyItem } from '@/types/article'
import VocabularyPreview from '@/components/shared/VocabularyPreview.vue'
import AiChatPanel from '@/components/shared/AiChatPanel.vue'
import { toast } from 'vue-sonner'

interface Props {
  article?: Article | null
  currentChapterIndex?: number
  isPlaying?: boolean
  currentTime?: number
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  article: null,
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
const articleId = Number(route.params.id)

const { chapter, isLoading, error: chapterError, fetchChapter } = useChapter()

const readingSettings = useReadingSettingsStore()

const showVocabulary = ref(false)
const showAiChat = ref(false)
const vocabularies = ref<VocabularyItem[]>([])
const isLoadingVocabulary = ref(false)

const lineHeightOptions: { value: LineHeight; label: string }[] = [
  { value: 'compact', label: '紧凑' },
  { value: 'normal', label: '标准' },
  { value: 'relaxed', label: '宽松' },
]

const contentWidthOptions: { value: ContentWidth; label: string }[] = [
  { value: 'narrow', label: '窄' },
  { value: 'medium', label: '中' },
  { value: 'wide', label: '宽' },
  { value: 'full', label: '充满' },
]

const totalChapters = computed(() => props.article?.chapters.length ?? 0)

const paragraphs = computed(() => {
  if (!chapter.value?.content) return []
  return chapter.value.content.split('\n\n').filter((p) => p.trim())
})

const loadChapter = async (index: number) => {
  await fetchChapter(articleId, index)
}

const goToPreviousChapter = async () => {
  if (props.currentChapterIndex > 0) {
    const newIndex = props.currentChapterIndex - 1
    emit('update:currentChapterIndex', newIndex)
    await loadChapter(newIndex)
  }
}

const goToNextChapter = async () => {
  if (props.currentChapterIndex < totalChapters.value - 1) {
    const newIndex = props.currentChapterIndex + 1
    emit('update:currentChapterIndex', newIndex)
    await loadChapter(newIndex)
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
  try {
    const data = await articleApi.getVocabulary(articleId)
    vocabularies.value = data.data
    showVocabulary.value = true
  } catch {
    toast.error('获取词汇失败')
  } finally {
    isLoadingVocabulary.value = false
  }
}

watch(
  () => props.currentChapterIndex,
  async (newIndex) => {
    if (props.article && props.article.chapters.length > 0) {
      await loadChapter(newIndex)
    }
  }
)

watch(
  () => props.article,
  async (newArticle) => {
    if (newArticle && newArticle.chapters.length > 0) {
      await loadChapter(props.currentChapterIndex)
    }
  }
)

watch(chapterError, (err) => {
  if (err) {
    toast.error(err)
  }
})

onMounted(async () => {
  if (props.article && props.article.chapters.length > 0) {
    await loadChapter(props.currentChapterIndex)
  }
})

defineExpose({
  fetchVocabulary,
})
</script>

<template>
  <div class="h-full flex flex-col relative">
    <div class="flex-1 min-h-0 overflow-auto px-4 py-6">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <Loader2 class="size-8 animate-spin text-muted-foreground" />
      </div>

      <div v-else-if="chapterError" class="flex items-center justify-center h-full">
        <div class="text-center">
          <p class="text-destructive mb-4">{{ chapterError }}</p>
          <Button @click="loadChapter(props.currentChapterIndex)">重试</Button>
        </div>
      </div>

      <ArticleReader
        v-else-if="chapter"
        :paragraphs="paragraphs"
        :chapter-title="chapter?.title"
      />
    </div>

    <div class="md:hidden flex-none border-t bg-background">
      <div class="flex items-center justify-between px-3 py-2 border-b">
        <div class="flex items-center gap-1">
          <Button variant="outline" size="icon" class="size-8" @click="readingSettings.decrementFontSize">
            <Minus class="size-4" />
          </Button>
          <Button variant="outline" size="icon" class="size-8" @click="readingSettings.incrementFontSize">
            <Plus class="size-4" />
          </Button>
        </div>

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

    <Button
      class="fixed bottom-20 right-4 md:bottom-4 size-12 rounded-full shadow-lg"
      @click="showAiChat = true"
    >
      <Bot class="size-6" />
    </Button>

    <AiChatPanel
      v-model:open="showAiChat"
      :article-id="articleId"
      :article-title="props.article?.title ?? ''"
      :chapter-content="chapter?.content"
      :chapter-index="props.currentChapterIndex"
    />
  </div>
</template>
