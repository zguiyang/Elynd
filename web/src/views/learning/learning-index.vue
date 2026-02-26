<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlayCircle, Search, ArrowRight, Clock, BookMarked } from 'lucide-vue-next'

const mockUser = {
  name: '学习者',
}

const mockStats = [
  { icon: Clock, label: '累计学习天数', value: '7', color: 'text-blue-500' },
  { icon: BookMarked, label: '阅读篇数', value: '12', color: 'text-green-500' },
  { icon: Search, label: '查词次数', value: '86', color: 'text-purple-500' },
]

const mockContinueReading = [
  {
    id: 1,
    title: 'The Future of AI in Education',
    difficulty: 'L2',
    category: '科技',
    progress: 65,
  },
  {
    id: 2,
    title: 'Tips for Remote Work Success',
    difficulty: 'L1',
    category: '职场',
    progress: 30,
  },
]

const mockRecommendedArticles = [
  {
    id: 3,
    title: 'Daily Conversation Phrases',
    difficulty: 'L1',
    category: '日常',
    description: 'Learn common phrases for everyday conversations.',
  },
  {
    id: 4,
    title: 'Understanding Business Meetings',
    difficulty: 'L2',
    category: '职场',
    description: 'Essential vocabulary and phrases for business meetings.',
  },
  {
    id: 5,
    title: 'Advanced Technical Writing',
    difficulty: 'L3',
    category: '科技',
    description: 'Improve your technical writing skills.',
  },
  {
    id: 6,
    title: 'Travel English Essentials',
    difficulty: 'L1',
    category: '日常',
    description: 'Must-know phrases for traveling abroad.',
  },
]

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
  <div class="space-y-8">
    <!-- Welcome Area -->
    <div class="space-y-2">
      <h1 class="text-3xl font-bold">你好，{{ mockUser.name }}</h1>
      <p class="text-muted-foreground">欢迎回来！继续你的英语学习之旅。</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card v-for="stat in mockStats" :key="stat.label">
        <CardContent class="flex items-center gap-4 py-6">
          <div :class="['flex h-12 w-12 items-center justify-center rounded-lg bg-muted', stat.color]">
            <component :is="stat.icon" class="size-6" />
          </div>
          <div>
            <p class="text-sm text-muted-foreground">{{ stat.label }}</p>
            <p class="text-2xl font-semibold">{{ stat.value }}</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Continue Reading -->
    <section v-if="mockContinueReading.length > 0">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">继续阅读</h2>
        <Button variant="ghost" size="sm" as-child>
          <RouterLink to="/learning/articles">
            查看全部
            <ArrowRight class="ml-2 size-4" />
          </RouterLink>
        </Button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          v-for="article in mockContinueReading"
          :key="article.id"
          class="hover:shadow-md transition-shadow cursor-pointer"
        >
          <CardHeader>
            <div class="flex items-start justify-between">
              <div class="space-y-2">
                <CardTitle class="text-lg">{{ article.title }}</CardTitle>
                <div class="flex items-center gap-2">
                  <Badge :variant="getDifficultyVariant(article.difficulty)">
                    {{ article.difficulty }}
                  </Badge>
                  <Badge variant="outline">{{ article.category }}</Badge>
                </div>
              </div>
              <Button size="icon" variant="ghost">
                <PlayCircle class="size-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div class="space-y-1">
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">阅读进度</span>
                <span class="font-medium">{{ article.progress }}%</span>
              </div>
              <div class="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full transition-all"
                  :style="{ width: `${article.progress}%` }"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- Recommended Articles -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">推荐文章</h2>
        <Button variant="ghost" size="sm" as-child>
          <RouterLink to="/learning/articles">
            查看全部
            <ArrowRight class="ml-2 size-4" />
          </RouterLink>
        </Button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          v-for="article in mockRecommendedArticles"
          :key="article.id"
          class="hover:shadow-md transition-shadow cursor-pointer group"
        >
          <CardHeader>
            <div class="flex items-start justify-between">
              <CardTitle class="text-lg group-hover:text-primary transition-colors">
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
            <CardDescription class="text-base">
              {{ article.description }}
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </section>
  </div>
</template>
