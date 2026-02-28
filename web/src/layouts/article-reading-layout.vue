<script setup lang="ts">
import { ArrowLeft, Menu, BookOpen, MessageSquare } from 'lucide-vue-next'
import { useArticle } from '@/composables/useArticle'
import { articleApi } from '@/api/article'
import type { ChapterListItem, VocabularyItem } from '@/types/article'
import VocabularyPreview from '@/components/shared/VocabularyPreview.vue'
import { toast } from 'vue-sonner'

const route = useRoute()
const articleId = Number(route.params.id)

const { article, fetchArticle } = useArticle()

const currentChapterIndex = ref(0)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(180)

const isMobileTocOpen = ref(false)
const showVocabulary = ref(false)
const vocabularies = ref<VocabularyItem[]>([])
const isLoadingVocabulary = ref(false)

const chapters = computed<ChapterListItem[]>(() => article.value?.chapters ?? [])

const handleChapterSelect = (index: number) => {
  currentChapterIndex.value = index
}

const handleMobileChapterSelect = (index: number) => {
  currentChapterIndex.value = index
  isMobileTocOpen.value = false
}

const handlePlay = () => {
  isPlaying.value = true
}

const handlePause = () => {
  isPlaying.value = false
}

const handleReplay = () => {
  currentTime.value = 0
}

const handleSeek = (time: number) => {
  currentTime.value = time
}

const fetchVocabulary = async () => {
  if (vocabularies.value.length > 0) {
    showVocabulary.value = true
    return
  }

  isLoadingVocabulary.value = true
  try {
    const response = await articleApi.getVocabulary(articleId)
    vocabularies.value = response.data
    showVocabulary.value = true
  } catch {
    toast.error('获取词汇失败')
  } finally {
    isLoadingVocabulary.value = false
  }
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
})
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
          :disabled="isLoadingVocabulary"
          @click="fetchVocabulary"
        >
          <BookOpen class="size-4" />
          词汇
        </Button>
        <Button variant="outline" size="sm" class="gap-2">
          <MessageSquare class="size-4" />
          <span class="hidden sm:inline">AI</span>
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

    <Dialog v-model:open="showVocabulary">
      <DialogContent class="max-w-lg">
        <VocabularyPreview :vocabularies="vocabularies" @close="showVocabulary = false" />
      </DialogContent>
    </Dialog>
  </div>
</template>
