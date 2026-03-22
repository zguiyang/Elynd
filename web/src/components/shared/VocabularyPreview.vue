<script setup lang="ts">
import { ChevronDown, ChevronUp, Loader2, Volume2, X } from 'lucide-vue-next'
import type { VocabularyItem } from '@/types/book'
import { getMeaningExamples } from '@/lib/dictionary-meaning'
import { useWordAudio } from '@/composables/useWordAudio'

defineProps<{
  vocabularies: VocabularyItem[]
}>()

const emit = defineEmits<{
  close: []
}>()

const expandedItems = ref<Set<number>>(new Set())
const { playWordAudio, isWordAudioLoading } = useWordAudio()

const toggleItem = (id: number) => {
  if (expandedItems.value.has(id)) {
    expandedItems.value.delete(id)
  } else {
    expandedItems.value.add(id)
  }
}

const isExpanded = (id: number) => expandedItems.value.has(id)

const hasDetails = (item: VocabularyItem) => {
  return item.meanings.length > 0
}

const getPhoneticText = (item: VocabularyItem) => {
  return item.phonetic || null
}

const getPrimaryMeaning = (item: VocabularyItem) => {
  return item.meanings[0]?.localizedMeaning || '-'
}
</script>

<template>
  <div class="p-4">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold">预习关键词 ({{ vocabularies.length }})</h3>
      <Button variant="ghost" size="icon" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <div class="max-h-[60vh] space-y-0 overflow-y-auto divide-y divide-border/60">
      <div
        v-for="item in vocabularies"
        :key="item.id"
        class="py-3 first:pt-0 last:pb-0"
      >
        <div class="flex items-start justify-between gap-3">
          <button
            class="min-w-0 flex-1 text-left"
            type="button"
            @click="toggleItem(item.id)"
          >
            <div class="flex items-center gap-3">
              <span class="font-medium leading-tight">{{ item.word }}</span>
              <span v-if="getPhoneticText(item)" class="text-sm text-muted-foreground">
                {{ getPhoneticText(item) }}
              </span>
            </div>
            <p v-if="getPrimaryMeaning(item)" class="mt-1 text-sm text-muted-foreground">
              {{ getPrimaryMeaning(item) }}
            </p>
          </button>

          <div class="flex items-center gap-1.5">
            <Button
              v-if="item.word"
              variant="ghost"
              size="icon"
              class="size-7"
              :disabled="isWordAudioLoading(item.word)"
              @click.stop="playWordAudio(item.word)"
            >
              <Loader2
                v-if="isWordAudioLoading(item.word)"
                class="size-4 animate-spin"
              />
              <Volume2 v-else class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" class="size-7" @click="toggleItem(item.id)">
              <ChevronDown v-if="!isExpanded(item.id)" class="size-4 text-muted-foreground shrink-0" />
              <ChevronUp v-else class="size-4 text-muted-foreground shrink-0" />
            </Button>
          </div>
        </div>

        <div v-if="isExpanded(item.id)" class="mt-3 space-y-4 border-l border-border/60 pl-4">
          <template v-if="hasDetails(item)">
            <div v-for="(meaning, mIndex) in item.meanings" :key="mIndex" class="space-y-2">
              <div class="flex flex-wrap items-baseline gap-2">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {{ meaning.partOfSpeech }}
                </p>
                <p class="text-sm text-foreground">
                  {{ meaning.explanation }}
                </p>
              </div>

              <div v-if="getMeaningExamples(meaning).length > 0" class="space-y-2">
                <div v-for="(example, eIndex) in getMeaningExamples(meaning)" :key="eIndex" class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-muted-foreground">例句</span>
                    <span class="text-[11px] text-muted-foreground">
                      {{ example.source }}
                    </span>
                  </div>
                  <p class="text-sm leading-6 text-foreground">
                    {{ example.sourceText }}
                  </p>
                  <p v-if="example.localizedText" class="text-sm leading-6 text-muted-foreground">
                    {{ example.localizedText }}
                  </p>
                </div>
              </div>
            </div>
          </template>

          <p v-if="item.sentence" class="text-sm italic leading-6 text-muted-foreground">
            "{{ item.sentence }}"
          </p>
        </div>
      </div>
    </div>

    <div class="mt-4 border-t pt-4">
      <Button class="w-full" @click="emit('close')">
        开始阅读
      </Button>
    </div>
  </div>
</template>
