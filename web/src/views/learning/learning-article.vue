<script setup lang="ts">
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Send,
  Bot,
  X,
} from 'lucide-vue-next'

const route = useRoute()
const articleId = route.params.id

const mockArticle = {
  id: articleId,
  title: 'The Future of AI in Education',
  difficulty: 'L2',
  category: '科技',
  content: `Artificial intelligence is transforming education in ways that were once thought impossible. From personalized learning experiences to automated grading systems, AI is making education more accessible and efficient.

One of the most exciting developments is the use of AI-powered tutoring systems. These systems can adapt to each student's learning style and pace, providing customized feedback and recommendations. This approach, known as adaptive learning, has shown promising results in improving student outcomes.

Another area where AI is making a significant impact is in language learning. Advanced natural language processing algorithms can now accurately assess pronunciation and grammar, providing learners with instant feedback. This technology enables students to practice speaking and writing without the fear of making mistakes.

However, the integration of AI in education also raises important questions about privacy and data security. Schools and universities must ensure that student data is protected and used responsibly. Additionally, there are concerns about the potential for AI to replace teachers, leading to debates about the role of human instructors in the classroom.

Despite these challenges, the future of AI in education looks bright. As technology continues to advance, we can expect even more innovative applications that will make learning engaging and effective for students worldwide.`,
}

const mockWordDefinitions: Record<string, { en: string; zh: string }> = {
  artificial: { en: 'made or produced by human beings', zh: '人工的，人造的' },
  intelligence: { en: 'the ability to learn and understand', zh: '智力，理解力' },
  education: { en: 'the process of receiving instruction', zh: '教育，培养' },
  personalized: { en: 'designed for a specific individual', zh: '个性化的' },
  adaptive: { en: 'able to adjust to new situations', zh: '适应性的' },
}

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(180)

const selectedWord = ref<string | null>(null)
const wordPosition = ref({ x: 0, y: 0 })

const aiQuestion = ref('')
const aiMessages = ref<{ role: 'user' | 'ai'; content: string }[]>([])
const isAiLoading = ref(false)

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
}

const replay = () => {
  currentTime.value = 0
  isPlaying.value = true
}

const handleWordClick = (event: MouseEvent, word: string) => {
  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()
  wordPosition.value = {
    x: rect.left + rect.width / 2,
    y: rect.top - 10,
  }
  selectedWord.value = word.toLowerCase()
}

const closeWordPopup = () => {
  selectedWord.value = null
}

const sendAiQuestion = async () => {
  if (!aiQuestion.value.trim()) return

  const question = aiQuestion.value
  aiMessages.value.push({ role: 'user', content: question })
  aiQuestion.value = ''
  isAiLoading.value = true

  setTimeout(() => {
    aiMessages.value.push({
      role: 'ai',
      content: '这是一个基于AI的回答。在实际实现中，这里将连接后端的AI问答API来获取回答。',
    })
    isAiLoading.value = false
  }, 1000)
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" as-child>
        <RouterLink to="/learning/articles">
          <ArrowLeft class="size-5" />
        </RouterLink>
      </Button>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold">{{ mockArticle.title }}</h1>
          <Badge :variant="mockArticle.difficulty === 'L2' ? 'default' : 'secondary'">
            {{ mockArticle.difficulty }}
          </Badge>
          <Badge variant="outline">{{ mockArticle.category }}</Badge>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Article Content -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Audio Player -->
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

        <!-- Article Text -->
        <Card>
          <CardHeader>
            <CardTitle>正文</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="prose prose-lg dark:prose-invert max-w-none">
              <p
                v-for="(paragraph, index) in mockArticle.content.split('\n\n')"
                :key="index"
                class="leading-relaxed mb-4"
              >
                <span
                  v-for="word in paragraph.split(' ')"
                  :key="word"
                  class="cursor-pointer hover:text-primary transition-colors"
                  @click="handleWordClick($event, word)"
                >
                  {{ word }}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Word Definition Popup -->
        <div
          v-if="selectedWord && mockWordDefinitions[selectedWord]"
          class="fixed z-50"
          :style="{ left: `${wordPosition.x}px`, top: `${wordPosition.y}px`, transform: 'translate(-50%, -100%)' }"
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
                {{ mockWordDefinitions[selectedWord]?.en }}
              </p>
              <p class="text-sm text-muted-foreground mt-1">
                <span class="font-medium">中:</span>
                {{ mockWordDefinitions[selectedWord]?.zh }}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- AI Q&A Sidebar -->
      <div class="lg:col-span-1">
        <Card class="sticky top-24 h-[calc(100vh-12rem)] flex flex-col">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Bot class="size-5" />
              AI 问答
            </CardTitle>
          </CardHeader>
          <CardContent class="flex-1 flex flex-col min-h-0">
            <!-- Messages -->
            <div class="flex-1 overflow-y-auto space-y-4 mb-4">
              <div v-if="aiMessages.length === 0" class="text-center text-muted-foreground py-8">
                <Bot class="size-8 mx-auto mb-2 opacity-50" />
                <p class="text-sm">针对文章内容向 AI 提问</p>
              </div>
              <div
                v-for="(message, index) in aiMessages"
                :key="index"
                :class="[
                  'p-3 rounded-lg text-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-8'
                    : 'bg-muted mr-8',
                ]"
              >
                {{ message.content }}
              </div>
              <div v-if="isAiLoading" class="text-center text-muted-foreground">
                <Bot class="size-5 mx-auto animate-pulse" />
              </div>
            </div>

            <!-- Input -->
            <div class="space-y-2">
              <Textarea
                v-model="aiQuestion"
                placeholder="输入你的问题..."
                :disabled="isAiLoading"
                @keydown.enter.meta="sendAiQuestion"
                @keydown.enter.ctrl="sendAiQuestion"
              />
              <Button class="w-full" :disabled="isAiLoading || !aiQuestion.trim()" @click="sendAiQuestion">
                <Send class="size-4 mr-2" />
                发送
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
