<script setup lang="ts">
import { BookOpen, ArrowLeft } from 'lucide-vue-next'

const difficulties = ['全部', 'L1', 'L2', 'L3'] as const
type Difficulty = typeof difficulties[number]

const selectedDifficulty = ref<Difficulty>('全部')

const mockArticles = [
  {
    id: 1,
    title: 'The Future of AI in Education',
    difficulty: 'L2',
    category: '科技',
    description: 'Exploring how artificial intelligence is transforming the way we learn and teach.',
  },
  {
    id: 2,
    title: 'Tips for Remote Work Success',
    difficulty: 'L1',
    category: '职场',
    description: 'Practical advice for staying productive and connected while working from home.',
  },
  {
    id: 3,
    title: 'Daily Conversation Phrases',
    difficulty: 'L1',
    category: '日常',
    description: 'Learn common phrases for everyday conversations with native speakers.',
  },
  {
    id: 4,
    title: 'Understanding Business Meetings',
    difficulty: 'L2',
    category: '职场',
    description: 'Essential vocabulary and phrases for participating in business meetings.',
  },
  {
    id: 5,
    title: 'Advanced Technical Writing',
    difficulty: 'L3',
    category: '科技',
    description: 'Improve your technical writing skills for documentation and reports.',
  },
  {
    id: 6,
    title: 'Travel English Essentials',
    difficulty: 'L1',
    category: '日常',
    description: 'Must-know phrases for traveling abroad and communicating with locals.',
  },
  {
    id: 7,
    title: 'The Science of Climate Change',
    difficulty: 'L3',
    category: '科技',
    description: 'Understanding the scientific basis of climate change and its impacts.',
  },
  {
    id: 8,
    title: 'Networking for Professionals',
    difficulty: 'L2',
    category: '职场',
    description: 'Build meaningful professional relationships in your industry.',
  },
]

const filteredArticles = computed(() => {
  if (selectedDifficulty.value === '全部') {
    return mockArticles
  }
  return mockArticles.filter(article => article.difficulty === selectedDifficulty.value)
})

const getDifficultyVariant = (difficulty: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    L1: 'secondary',
    L2: 'default',
    L3: 'outline',
  }
  return variants[difficulty] || 'secondary'
}
</script>

<template>
  <div class="space-y-6 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" as-child>
        <RouterLink to="/learning">
          <ArrowLeft class="size-5" />
        </RouterLink>
      </Button>
      <h1 class="text-2xl font-bold">文章列表</h1>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">难度筛选：</span>
      <div class="flex gap-2">
        <Button
          v-for="difficulty in difficulties"
          :key="difficulty"
          :variant="selectedDifficulty === difficulty ? 'default' : 'outline'"
          size="sm"
          @click="selectedDifficulty = difficulty"
        >
          {{ difficulty }}
        </Button>
      </div>
    </div>

    <!-- Articles Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <RouterLink
        v-for="article in filteredArticles"
        :key="article.id"
        :to="`/learning/article/${article.id}`"
      >
        <Card class="h-full hover:shadow-md transition-all cursor-pointer group">
          <CardHeader>
            <div class="flex items-start justify-between">
              <CardTitle class="text-lg group-hover:text-primary transition-colors line-clamp-2">
                {{ article.title }}
              </CardTitle>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <Badge :variant="getDifficultyVariant(article.difficulty)">
                {{ article.difficulty }}
              </Badge>
              <Badge variant="outline">{{ article.category }}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription class="text-base line-clamp-3">
              {{ article.description }}
            </CardDescription>
          </CardContent>
        </Card>
      </RouterLink>
    </div>

    <!-- Empty State -->
    <div v-if="filteredArticles.length === 0" class="text-center py-12">
      <BookOpen class="size-12 mx-auto text-muted-foreground mb-4" />
      <p class="text-muted-foreground">暂无文章</p>
    </div>
  </div>
</template>
