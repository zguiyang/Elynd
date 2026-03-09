<script setup lang="ts">
import { ArrowRight, BookMarked, Clock, Loader2, PlayCircle, Search } from 'lucide-vue-next'
import type { LearningIndexData } from '@/api/learning'
import { learningApi } from '@/api/learning'
import { useAuthStore } from '@/stores/auth'
import { useRequest } from '@/composables/useRequest'
import { toast } from 'vue-sonner'

const authStore = useAuthStore()

const isLoading = ref(true)
const userData = ref<LearningIndexData | null>(null)

const userName = computed(() => authStore.user?.fullName || '学习者')

const stats = ref<Array<{ icon: typeof Clock; label: string; value: string; color: string }>>([])

const continueReading = ref<
  Array<{
    id: number
    title: string
    difficulty: string
    category: string
    progress: number
  }>
>([])

const recommendedArticles = ref<
  Array<{
    id: number
    title: string
    difficulty: string
    category: string
    description: string | null
  }>
>([])

const getDifficultyVariant = (difficulty: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    L1: 'secondary',
    L2: 'default',
    L3: 'outline',
  }
  return variants[difficulty] || 'secondary'
}

const fetchData = useRequest<LearningIndexData>({
  fetcher: learningApi.getIndex,
})

onMounted(async () => {
  const result = await fetchData.execute()
  isLoading.value = false
  if (result) {
    userData.value = result
    stats.value = [
      { icon: Clock, label: '累计学习天数', value: String(result.learningDays), color: 'text-blue-500' },
      { icon: BookMarked, label: '阅读篇数', value: String(result.articlesReadCount), color: 'text-green-500' },
      { icon: Search, label: '查词次数', value: '0', color: 'text-purple-500' },
    ]
    continueReading.value = result.continueReading
    recommendedArticles.value = result.recommendedArticles
  }
})

watch(
  () => fetchData.error.value,
  (err) => {
    if (err) {
      toast.error('加载数据失败')
    }
  },
)
</script>

<template>
  <div class="space-y-8 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error State -->
    <div v-else-if="fetchData.error.value" class="text-center py-20">
      <p class="text-destructive">加载数据失败</p>
    </div>

    <!-- Content -->
    <template v-else-if="userData">
      <!-- Welcome Area -->
      <div class="space-y-2">
        <h1 class="text-3xl font-bold">你好，{{ userName }}</h1>
        <p class="text-muted-foreground">欢迎回来！继续你的英语学习之旅。</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card v-for="stat in stats" :key="stat.label">
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
      <section v-if="continueReading.length > 0">
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
            v-for="article in continueReading"
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
                <Button size="icon" variant="ghost" as-child>
                  <RouterLink :to="`/learning/article/${article.id}`">
                    <PlayCircle class="size-5" />
                  </RouterLink>
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

      <!-- No Reading History -->
      <section v-else>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">开始阅读</h2>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink to="/learning/articles">
              浏览文章
              <ArrowRight class="ml-2 size-4" />
            </RouterLink>
          </Button>
        </div>
        <Card class="p-8 text-center">
          <CardContent>
            <p class="text-muted-foreground mb-4">还没有开始任何阅读，快去选择一篇感兴趣的文章开始学习吧！</p>
            <Button as-child>
              <RouterLink to="/learning/articles">浏览文章</RouterLink>
            </Button>
          </CardContent>
        </Card>
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
            v-for="article in recommendedArticles"
            :key="article.id"
            class="hover:shadow-md transition-shadow cursor-pointer group"
            as-child
          >
            <RouterLink :to="`/learning/article/${article.id}`">
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
                <CardDescription v-if="article.description" class="text-base">
                  {{ article.description }}
                </CardDescription>
              </CardContent>
            </RouterLink>
          </Card>
        </div>
      </section>
    </template>
  </div>
</template>
