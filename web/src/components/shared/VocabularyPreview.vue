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
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold">预习关键词 ({{ vocabularies.length }})</h3>
      <Button variant="ghost" size="icon" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>
    
    <div class="space-y-2 max-h-[60vh] overflow-y-auto">
      <div
        v-for="item in vocabularies"
        :key="item.id"
        class="border rounded-lg overflow-hidden"
      >
        <button
          class="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
          @click="toggleItem(item.id)"
        >
          <div class="flex items-center gap-3">
            <span class="font-medium">{{ item.word }}</span>
            <span v-if="getPhoneticText(item)" class="text-sm text-muted-foreground">
              {{ getPhoneticText(item) }}
            </span>
          </div>
          <div class="flex items-center gap-2">
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
            <ChevronDown v-if="!isExpanded(item.id)" class="size-4 text-muted-foreground shrink-0" />
            <ChevronUp v-else class="size-4 text-muted-foreground shrink-0" />
          </div>
        </button>
        
        <div v-if="isExpanded(item.id)" class="px-3 pb-3 border-t bg-muted/30">
          <p class="text-sm font-medium mt-2">{{ getPrimaryMeaning(item) }}</p>
          
          <template v-if="hasDetails(item)">
            <div v-for="(meaning, mIndex) in item.meanings" :key="mIndex" class="mt-3">
              <p class="text-xs font-semibold text-primary">{{ meaning.partOfSpeech }}</p>
              <p class="text-sm mt-1">{{ meaning.explanation }}</p>
              <ul v-if="getMeaningExamples(meaning).length > 0" class="mt-2 space-y-1">
                <li v-for="(example, eIndex) in getMeaningExamples(meaning)" :key="eIndex" class="text-sm">
                  <span class="text-muted-foreground">{{ eIndex + 1 }}.</span>
                  <span class="ml-1">{{ example.sourceText }}</span>
                  <p class="text-xs text-muted-foreground ml-3 mt-0.5">
                    {{ example.localizedText }}
                  </p>
                </li>
              </ul>
            </div>
          </template>
          
          <p v-if="item.sentence" class="text-sm text-muted-foreground mt-2 italic">
            "{{ item.sentence }}"
          </p>
        </div>
      </div>
    </div>
    
    <div class="mt-4 pt-4 border-t">
      <Button class="w-full" @click="emit('close')">
        开始阅读
      </Button>
    </div>
  </div>
</template>
