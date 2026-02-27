<script setup lang="ts">
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  MessageSquare,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  BookOpen,
} from 'lucide-vue-next'
import { useReadingSettingsStore } from '@/stores/reading-settings'
import { useArticle } from '@/composables/useArticle'
import { articleApi } from '@/api/article'
import type { LineHeight, ContentWidth } from '@/stores/reading-settings'
import type { VocabularyItem } from '@/types/article'
import VocabularyPreview from '@/components/shared/VocabularyPreview.vue'
import { toast } from 'vue-sonner'

const route = useRoute()
const articleId = Number(route.params.id)

const { article, isLoading, error, fetchArticle } = useArticle()

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(180)

const currentPage = ref(1)
const totalPages = ref(1)

const isAiDrawerOpen = ref(false)

const showVocabulary = ref(false)
const vocabularies = ref<VocabularyItem[]>([])
const isLoadingVocabulary = ref(false)

const readingSettings = useReadingSettingsStore()

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

const lineHeightLabel = computed(
  () => lineHeightOptions.find((opt) => opt.value === readingSettings.lineHeight)?.label ?? '标准'
)

const contentWidthLabel = computed(
  () => contentWidthOptions.find((opt) => opt.value === readingSettings.contentWidth)?.label ?? '充满'
)

const paragraphs = computed(() => {
  if (!article.value?.content) return []
  return article.value.content.split('\n\n').filter((p) => p.trim())
})

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
}

const replay = () => {
  currentTime.value = 0
  isPlaying.value = true
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const goToPreviousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const goToNextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

const handleWordClick = (word: string) => {
  console.log('Word clicked:', word)
}

const openAiDrawer = () => {
  isAiDrawerOpen.value = true
}

const fetchVocabulary = async () => {
  if (vocabularies.value.length > 0) {
    showVocabulary.value = true
    return
  }
  
  isLoadingVocabulary.value = true
  try {
    const data = await articleApi.getVocabulary(articleId)
    vocabularies.value = data
    showVocabulary.value = true
  } catch {
    toast.error('获取词汇失败')
  } finally {
    isLoadingVocabulary.value = false
  }
}

onMounted(() => {
  fetchArticle(articleId)
})

watch(error, (err) => {
  if (err) {
    toast.error(err)
  }
})

const getDifficultyVariant = (difficulty: string): 'default' | 'secondary' | 'outline' => {
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    L1: 'secondary',
    L2: 'default',
    L3: 'outline',
  }
  return variants[difficulty] || 'secondary'
}
</script>

<template>
  <!-- 页面级容器：占满剩余高度，无滚动条 -->
  <div class="h-full overflow-hidden flex flex-col bg-background relative container mx-auto">
    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-background/50 z-50"
    >
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error State -->
    <div
      v-if="error && !article"
      class="absolute inset-0 flex items-center justify-center bg-background z-50"
    >
      <div class="text-center">
        <p class="text-destructive mb-4">{{ error }}</p>
        <Button @click="fetchArticle(articleId)">重试</Button>
      </div>
    </div>

    <template v-if="article">
      <!-- 头部栏 -->
      <header class="flex-none bg-background/95 backdrop-blur-sm border-b">
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" as-child>
              <RouterLink to="/learning/articles">
                <ArrowLeft class="size-5" />
              </RouterLink>
            </Button>
            <h1 class="text-lg font-semibold truncate">{{ article.title }}</h1>
            <Badge v-if="article.difficultyLevel" :variant="getDifficultyVariant(article.difficultyLevel)">
              {{ article.difficultyLevel }}
            </Badge>
            <Badge
              v-for="tag in article.tags"
              :key="tag.id"
              variant="outline"
            >
              {{ tag.name }}
            </Badge>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              class="gap-2" 
              @click="fetchVocabulary"
              :disabled="isLoadingVocabulary"
            >
              <BookOpen class="size-4" />
              预习关键词
              <span v-if="vocabularies.length > 0">({{ vocabularies.length }})</span>
            </Button>
            <Button variant="outline" size="sm" class="gap-2" @click="openAiDrawer">
              <MessageSquare class="size-4" />
              AI 问答
            </Button>
          </div>
        </div>
      </header>

      <!-- 工具栏 -->
      <div class="flex-none bg-background/95 backdrop-blur-sm border-b">
        <div class="flex items-center justify-between px-4 py-2 flex-wrap gap-2">
          <div class="flex items-center gap-2">
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

          <!-- 翻页按钮 -->
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage <= 1"
              @click="goToPreviousPage"
            >
              <ChevronLeft class="size-4" />
            </Button>
            <span class="text-sm text-muted-foreground min-w-(60px) text-center">
              {{ currentPage }} / {{ totalPages }}
            </span>
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage >= totalPages"
              @click="goToNextPage"
            >
              <ChevronRight class="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- 内容区域：flex-1 填充剩余空间，内部可滚动 -->
      <main class="flex-1 min-h-0 flex flex-col px-4 pb-6 mt-4 w-full">
        <ArticleReader
          :paragraphs="paragraphs"
          :word-definitions="{}"
          @word-click="handleWordClick"
        />
      </main>

      <!-- 音频播放器：绝对定位，固定宽度，水平居中 -->
      <div class="absolute bottom-14 left-1/2 -translate-x-1/2 z-40">
        <Card class="shadow-xl border bg-background/60 backdrop-blur-md py-0">
          <CardContent class="flex items-center gap-3 p-3">
            <Button
              :variant="isPlaying ? 'default' : 'outline'"
              size="icon"
              class="size-8"
              @click="togglePlay"
            >
              <Pause v-if="isPlaying" class="size-4" />
              <Play v-else class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" class="size-8" @click="replay">
              <RotateCcw class="size-4" />
            </Button>
            <div class="flex items-center gap-2 w-48">
              <Volume2 class="size-4 text-muted-foreground shrink-0" />
              <div class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full transition-all"
                  :style="{ width: `${(currentTime / duration) * 100}%` }"
                />
              </div>
            </div>
            <span class="text-xs text-muted-foreground shrink-0">
              {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
            </span>
          </CardContent>
        </Card>
      </div>
    </template>

    <AiChatDrawer v-model:open="isAiDrawerOpen" />
    
    <Dialog v-model:open="showVocabulary">
      <DialogContent class="max-w-lg">
        <VocabularyPreview
          :vocabularies="vocabularies"
          @close="showVocabulary = false"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
