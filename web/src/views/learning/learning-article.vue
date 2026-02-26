<script setup lang="ts">
import { ArrowLeft, Play, Pause, RotateCcw, Volume2, MessageSquare } from 'lucide-vue-next'

const route = useRoute()
const articleId = route.params.id

const mockArticle = {
  id: articleId,
  title: 'The Future of AI in Education',
  difficulty: 'L2',
  category: '科技',
  paragraphs: [
    `Artificial intelligence is transforming education in ways that were once thought impossible. From personalized learning experiences to automated grading systems, AI is making education more accessible and efficient.`,
    `One of the most exciting developments is the use of AI-powered tutoring systems. These systems can adapt to each student's learning style and pace, providing customized feedback and recommendations. This approach, known as adaptive learning, has shown promising results in improving student outcomes.`,
    `Another area where AI is making a significant impact is in language learning. Advanced natural language processing algorithms can now accurately assess pronunciation and grammar, providing learners with instant feedback. This technology enables students to practice speaking and writing without the fear of making mistakes.`,
  ],
}

const mockWordDefinitions: Record<string, { en: string; zh: string }> = {
  artificial: { en: 'made or produced by human beings', zh: '人工的，人造的' },
  intelligence: { en: 'the ability to learn and understand', zh: '智力，理解力' },
  education: { en: 'the process of receiving instruction', zh: '教育，培养' },
  personalized: { en: 'designed for a specific individual', zh: '个性化的' },
  adaptive: { en: 'able to adjust to new situations', zh: '适应性的' },
  transforming: { en: 'to change completely the nature or appearance', zh: '改变，转变' },
  experiences: { en: 'practical contact with and observation of facts', zh: '经验，体验' },
  automated: { en: 'operated by machines or computers', zh: '自动化的' },
}

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(180)

const currentPage = ref(1)
const totalPages = ref(5)

const isAiDrawerOpen = ref(false)

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

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const handleWordClick = (word: string) => {
  console.log('Word clicked:', word)
}

const openAiDrawer = () => {
  isAiDrawerOpen.value = true
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" as-child>
          <RouterLink to="/learning/articles">
            <ArrowLeft class="size-5" />
          </RouterLink>
        </Button>
      </div>
      <Button variant="outline" size="sm" class="gap-2" @click="openAiDrawer">
        <MessageSquare class="size-4" />
        AI 问答
      </Button>
    </div>

    <Card>
      <CardContent class="flex items-center gap-4 py-4">
        <Button
          :variant="isPlaying ? 'default' : 'outline'"
          size="icon"
          @click="togglePlay"
        >
          <Pause v-if="isPlaying" class="size-5" />
          <Play v-else class="size-5" />
        </Button>
        <Button variant="ghost" size="icon" @click="replay">
          <RotateCcw class="size-5" />
        </Button>
        <div class="flex-1 flex items-center gap-3">
          <Volume2 class="size-5 text-muted-foreground" />
          <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all"
              :style="{ width: `${(currentTime / duration) * 100}%` }"
            />
          </div>
          <span class="text-sm text-muted-foreground">
            {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
          </span>
        </div>
      </CardContent>
    </Card>

    <ArticleReader
      :title="mockArticle.title"
      :paragraphs="mockArticle.paragraphs"
      :current-page="currentPage"
      :total-pages="totalPages"
      :difficulty="mockArticle.difficulty"
      :category="mockArticle.category"
      :word-definitions="mockWordDefinitions"
      @update:current-page="handlePageChange"
      @word-click="handleWordClick"
    />

    <AiChatDrawer v-model:open="isAiDrawerOpen" />
  </div>
</template>
