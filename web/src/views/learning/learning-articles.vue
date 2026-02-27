<script setup lang="ts">
import { BookOpen, ArrowLeft, Loader2 } from 'lucide-vue-next'
import { useArticles } from '@/composables/useArticle'
import { toast } from 'vue-sonner'

const difficulties = [
  { value: undefined, label: '全部' },
  { value: 'L1', label: 'L1' },
  { value: 'L2', label: 'L2' },
  { value: 'L3', label: 'L3' },
] as const
type Difficulty = typeof difficulties[number]['value']

const selectedDifficulty = ref<Difficulty>(undefined)
const selectedTagId = ref<number | undefined>(undefined)

const { articles, tags, isLoading, error, pagination, fetchArticles, fetchTags, goToPage } =
  useArticles()

const loadData = () => {
  fetchArticles({
    difficulty: selectedDifficulty.value,
    tagId: selectedTagId.value,
    page: 1,
  })
}

const onDifficultyChange = (difficulty: Difficulty) => {
  selectedDifficulty.value = difficulty
  selectedTagId.value = undefined
  loadData()
}

const onTagChange = (tagId: number | undefined) => {
  selectedTagId.value = tagId
  loadData()
}

const onPageChange = (page: number) => {
  goToPage(page)
}

onMounted(() => {
  fetchTags()
  loadData()
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
    <div class="flex flex-col sm:flex-row gap-4">
      <!-- Difficulty Filter -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">难度筛选：</span>
        <div class="flex gap-2">
          <Button
            v-for="difficulty in difficulties"
            :key="difficulty.label"
            :variant="selectedDifficulty === difficulty.value ? 'default' : 'outline'"
            size="sm"
            @click="onDifficultyChange(difficulty.value)"
          >
            {{ difficulty.label }}
          </Button>
        </div>
      </div>

      <!-- Tag Filter -->
      <div v-if="tags.length > 0" class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">标签筛选：</span>
        <Select
          :model-value="selectedTagId"
          @update:model-value="onTagChange"
        >
          <SelectTrigger class="w-40">
            <SelectValue placeholder="选择标签" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="undefined">全部</SelectItem>
            <SelectItem
              v-for="tag in tags"
              :key="tag.id"
              :value="tag.id"
            >
              {{ tag.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Articles Grid -->
    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <RouterLink
          v-for="article in articles"
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
              <div class="flex items-center gap-2 mt-2 flex-wrap">
                <Badge :variant="getDifficultyVariant(article.difficultyLevel)">
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
            </CardHeader>
            <CardContent>
              <div class="text-sm text-muted-foreground">
                {{ article.readingTime ? `${article.readingTime} 分钟阅读` : '' }}
                {{ article.wordCount ? `· ${article.wordCount} 词` : '' }}
              </div>
            </CardContent>
          </Card>
        </RouterLink>
      </div>

      <!-- Empty State -->
      <div v-if="articles.length === 0" class="text-center py-12">
        <BookOpen class="size-12 mx-auto text-muted-foreground mb-4" />
        <p class="text-muted-foreground">暂无文章</p>
      </div>

      <!-- Pagination -->
      <div
        v-if="pagination.lastPage > 1"
        class="flex justify-center items-center gap-2"
      >
        <Button
          variant="outline"
          size="sm"
          :disabled="pagination.currentPage <= 1"
          @click="onPageChange(pagination.currentPage - 1)"
        >
          上一页
        </Button>
        <span class="text-sm text-muted-foreground">
          {{ pagination.currentPage }} / {{ pagination.lastPage }}
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="pagination.currentPage >= pagination.lastPage"
          @click="onPageChange(pagination.currentPage + 1)"
        >
          下一页
        </Button>
      </div>
    </template>
  </div>
</template>
