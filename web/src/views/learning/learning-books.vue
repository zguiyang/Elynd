<script setup lang="ts">
import { BookOpen, ArrowLeft, Loader2 } from 'lucide-vue-next'
import { useBooks } from '@/composables/useBook'
import { toast } from 'vue-sonner'

const { books, tags, isLoading, error, pagination, fetchBooks, fetchTags, goToPage } = useBooks()

const difficulties = [
  { value: undefined, label: '全部' },
  { value: 'L1', label: 'L1' },
  { value: 'L2', label: 'L2' },
  { value: 'L3', label: 'L3' },
] as const
type Difficulty = typeof difficulties[number]['value']

const selectedDifficulty = ref<Difficulty>(undefined)
const selectedTagId = ref<number | 'all' | undefined>('all')

const loadData = () => {
  const tagId = selectedTagId.value === 'all' ? undefined : selectedTagId.value
  fetchBooks({
    difficulty: selectedDifficulty.value,
    tagId: tagId,
    page: 1,
  })
}

const onTagChange = (value: unknown) => {
  const tagId = value as number | 'all' | undefined
  selectedTagId.value = tagId
  loadData()
}

const onDifficultyChange = (difficulty: Difficulty) => {
  selectedDifficulty.value = difficulty
  selectedTagId.value = undefined
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
      <h1 class="text-2xl font-bold">书籍列表</h1>
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
            <SelectItem value="all">全部</SelectItem>
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

    <!-- Books Grid -->
    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <RouterLink
          v-for="book in books"
          :key="book.id"
          :to="`/learning/book/${book.id}`"
        >
          <Card class="h-full hover:shadow-md transition-all cursor-pointer group">
            <CardHeader>
              <div class="flex items-start justify-between">
                <CardTitle class="text-lg group-hover:text-primary transition-colors line-clamp-2">
                  {{ book.title }}
                </CardTitle>
              </div>
              <div class="flex items-center gap-2 mt-2 flex-wrap">
                <Badge :variant="getDifficultyVariant(book.difficultyLevel)">
                  {{ book.difficultyLevel }}
                </Badge>
                <Badge
                  v-for="tag in book.tags"
                  :key="tag.id"
                  variant="outline"
                >
                  {{ tag.name }}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div class="text-sm text-muted-foreground">
                {{ book.readingTime ? `${book.readingTime} 分钟阅读` : '' }}
                {{ book.wordCount ? `· ${book.wordCount} 词` : '' }}
              </div>
            </CardContent>
          </Card>
        </RouterLink>
      </div>

      <!-- Empty State -->
      <div v-if="books.length === 0" class="text-center py-12">
        <BookOpen class="size-12 mx-auto text-muted-foreground mb-4" />
        <p class="text-muted-foreground">暂无书籍</p>
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
