<script setup lang="ts">
import { ArrowRight, BookMarked, Clock, Loader2, PlayCircle, Search } from 'lucide-vue-next'
import type { LearningIndexData } from '@/api/learning'
import { learningApi } from '@/api/learning'
import { useAuthStore } from '@/stores/auth'
import { useRequest } from '@/composables/useRequest'
import { formatBookLevelRange } from '@/lib/book-level'
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
    level: {
      id: number
      code: string
      description: string
      minWords: number | null
      maxWords: number | null
      sortOrder: number
    }
    category: string
    progress: number
  }>
>([])

const recommendedBooks = ref<
  Array<{
    id: number
    title: string
    level: {
      id: number
      code: string
      description: string
      minWords: number | null
      maxWords: number | null
      sortOrder: number
    }
    category: string
    description: string | null
  }>
>([])

const getLevelVariant = (sortOrder: number): 'default' | 'secondary' | 'outline' => {
  if (sortOrder === 1) return 'secondary'
  if (sortOrder === 2) return 'default'
  return 'outline'
}

const { execute, error } = useRequest<LearningIndexData>({
  fetcher: learningApi.getIndex,
})

onMounted(async () => {
  const result = await execute()
  isLoading.value = false
  if (result) {
    userData.value = result
    stats.value = [
      { icon: Clock, label: '累计学习天数', value: String(result.learningDays), color: 'text-primary' },
      { icon: BookMarked, label: '阅读篇数', value: String(result.booksReadCount), color: 'text-foreground' },
      { icon: Search, label: '查词次数', value: '0', color: 'text-muted-foreground' },
    ]
    continueReading.value = result.continueReading
    recommendedBooks.value = result.recommendedBooks
  }
})

watch(
  () => error.value,
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
    <div v-else-if="error" class="text-center py-20">
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
        <Card v-for="stat in stats" :key="stat.label" class="shadow-sm border-muted">
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

      <section v-if="continueReading.length > 0">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">继续阅读</h2>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink to="/learning/books">
              查看全部
              <ArrowRight class="ml-2 size-4" />
            </RouterLink>
          </Button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            v-for="book in continueReading"
            :key="book.id"
            class="hover:shadow-md transition-shadow cursor-pointer border-muted shadow-sm"
          >
            <CardHeader>
              <div class="flex items-start justify-between">
                <div class="space-y-2">
                  <CardTitle class="text-lg">{{ book.title }}</CardTitle>
                  <div class="flex items-center gap-2">
                    <Badge :variant="getLevelVariant(book.level.sortOrder)">
                      {{ formatBookLevelRange(book.level) }}
                    </Badge>
                    <Badge variant="outline">{{ book.category }}</Badge>
                  </div>
                </div>
                <Button size="icon" variant="ghost" as-child>
                  <RouterLink :to="`/learning/book/${book.id}`">
                    <PlayCircle class="size-5" />
                  </RouterLink>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="space-y-1">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">阅读进度</span>
                  <span class="font-medium">{{ book.progress }}%</span>
                </div>
                <div class="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    class="h-full bg-primary rounded-full transition-all"
                    :style="{ width: `${book.progress}%` }"
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
            <RouterLink to="/learning/books">
              浏览书籍
              <ArrowRight class="ml-2 size-4" />
            </RouterLink>
          </Button>
        </div>
        <Card class="p-8 text-center">
          <CardContent>
            <p class="text-muted-foreground mb-4">还没有开始任何阅读，快去选择一本感兴趣的书籍开始学习吧！</p>
            <Button as-child>
              <RouterLink to="/learning/books">浏览书籍</RouterLink>
            </Button>
          </CardContent>
        </Card>
      </section>

      <!-- Recommended Books -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">推荐书籍</h2>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink to="/learning/books">
              查看全部
              <ArrowRight class="ml-2 size-4" />
            </RouterLink>
          </Button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card
            v-for="book in recommendedBooks"
            :key="book.id"
            class="hover:shadow-md transition-shadow cursor-pointer group border-muted shadow-sm"
            as-child
          >
            <RouterLink :to="`/learning/book/${book.id}`">
              <CardHeader>
                <div class="flex items-start justify-between">
                  <CardTitle class="text-lg group-hover:text-primary transition-colors">
                    {{ book.title }}
                  </CardTitle>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <Badge :variant="getLevelVariant(book.level.sortOrder)">
                    {{ formatBookLevelRange(book.level) }}
                  </Badge>
                  <Badge variant="outline">{{ book.category }}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription v-if="book.description" class="text-base">
                  {{ book.description }}
                </CardDescription>
              </CardContent>
            </RouterLink>
          </Card>
        </div>
      </section>
    </template>
  </div>
</template>
