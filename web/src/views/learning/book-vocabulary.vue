<script setup lang="ts">
import { ArrowLeft, BookOpen, Loader2, Volume2 } from 'lucide-vue-next'
import { bookApi } from '@/api/book'
import { useRequest } from '@/composables/useRequest'
import { toast } from 'vue-sonner'
import type { VocabularyItem } from '@/types/book'
import { getMeaningExamples } from '@/lib/dictionary-meaning'
import { useWordAudio } from '@/composables/useWordAudio'

const route = useRoute()
const router = useRouter()
const bookId = Number(route.params.id)

const vocabularies = ref<VocabularyItem[]>([])

const { execute, error, isLoading } = useRequest<VocabularyItem[]>({
  fetcher: () => bookApi.getVocabulary(bookId),
})

const { playWordAudio, isWordAudioLoading } = useWordAudio()

const getPhoneticText = (item: VocabularyItem) => {
  return item.phonetic || null
}

const goBack = () => {
  router.push(`/learning/book/${bookId}`)
}

const hasDetails = (item: VocabularyItem) => {
  return item.meanings.length > 0
}

const getPrimaryMeaning = (item: VocabularyItem) => {
  return item.meanings[0]?.localizedMeaning || '-'
}

const loadData = async () => {
  const result = await execute()
  if (result) {
    vocabularies.value = result
  }
}

watch(
  () => error.value,
  (err) => {
    if (err) {
      toast.error('获取词汇失败，请稍后重试')
    }
  },
)

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="container mx-auto px-4 py-6 md:px-6">
    <!-- 返回按钮 -->
    <Button
      variant="ghost"
      class="mb-4 -ml-2 cursor-pointer hover:bg-muted transition-colors duration-200"
      @click="goBack"
    >
      <ArrowLeft class="mr-2 size-4" />
      返回书籍
    </Button>

    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-3">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p class="text-sm text-muted-foreground">加载词汇中...</p>
      </div>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-20">
      <BookOpen class="size-12 text-muted-foreground mb-4" />
      <p class="text-muted-foreground">获取词汇失败，请稍后重试</p>
      <Button class="mt-4" @click="loadData">重试</Button>
    </div>

    <div v-else-if="vocabularies.length === 0" class="flex flex-col items-center justify-center py-20">
      <BookOpen class="size-12 text-muted-foreground mb-4" />
      <p class="text-muted-foreground">暂无词汇</p>
    </div>

    <div v-else>
      <div class="flex items-center gap-2 mb-6">
        <h1 class="text-2xl font-semibold">词汇表</h1>
        <Badge variant="secondary">{{ vocabularies.length }}</Badge>
      </div>

      <div class="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        <Card
          v-for="item in vocabularies"
          :key="item.id"
          class="overflow-hidden break-inside-avoid mb-4 cursor-pointer hover:shadow-lg transition-all duration-200"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <CardTitle class="text-lg font-semibold text-primary">
                  {{ item.word }}
                </CardTitle>
                <p v-if="getPhoneticText(item)" class="text-xs text-muted-foreground font-mono mt-0.5">
                  {{ getPhoneticText(item) }}
                </p>
              </div>
              <Button
                v-if="item.word"
                variant="ghost"
                size="icon"
                class="size-7 shrink-0"
                :disabled="isWordAudioLoading(item.word)"
                @click.stop="playWordAudio(item.word)"
              >
                <Loader2 v-if="isWordAudioLoading(item.word)" class="size-4 animate-spin" />
                <Volume2 v-else class="size-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent class="pt-0">
            <p class="text-sm">{{ getPrimaryMeaning(item) }}</p>

            <div v-if="hasDetails(item)" class="mt-2 space-y-2">
              <div class="flex flex-wrap gap-1">
                <Badge
                  v-for="meaning in item.meanings"
                  :key="meaning.partOfSpeech"
                  variant="secondary"
                  class="text-xs"
                >
                  {{ meaning.partOfSpeech }}
                </Badge>
              </div>

              <div v-for="meaning in item.meanings" :key="meaning.partOfSpeech" class="space-y-1">
                <p class="text-sm">{{ meaning.explanation }}</p>
                <div v-for="(example, exampleIndex) in getMeaningExamples(meaning).slice(0, 2)" :key="exampleIndex" class="ml-1">
                  <p class="text-xs">
                    <span class="text-muted-foreground">{{ exampleIndex + 1 }}.</span>
                    <span class="ml-1">{{ example.sourceText }}</span>
                  </p>
                  <p class="text-xs text-muted-foreground ml-4">
                    {{ example.localizedText }}
                  </p>
                </div>
              </div>
            </div>

            <div v-if="item.sentence" class="mt-2 pt-2 border-t">
              <p class="text-xs text-muted-foreground italic line-clamp-2">"{{ item.sentence }}"</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
