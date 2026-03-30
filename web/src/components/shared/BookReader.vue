<script setup lang="ts">
import {
  BookText,
  Copy,
  Languages,
  MessageCircleMore,
  Loader2,
  Search,
  Volume2,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { lookupWord } from '@/api/dictionary'
import type {
  DictionaryEntry,
  DictionaryExample,
  DictionaryLookupContext,
  DictionaryLookupError,
} from '@/api/dictionary'
import { READER_SELECTION } from '@/constants'
import { isSingleWordSelection, normalizeSelectionText } from '@/lib/selection-actions'
import { getMeaningExamples } from '@/lib/dictionary-meaning'
import { useWordAudio } from '@/composables/useWordAudio'
import type { ReaderActionType, ReaderSelectionActionPayload } from '@/types/reader-selection'
import { useReadingSettingsStore } from '@/stores/reading-settings'
import type { ChapterSentenceTiming } from '@/types/book'
import MarkdownRenderer from '@/components/shared/MarkdownRenderer.vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  paragraphs: string[]
  chapterTitle?: string
  markdownContent?: string
  bookId?: number
  chapterIndex?: number
  currentTime?: number
  sentenceTimings?: ChapterSentenceTiming[] | null
}

const props = withDefaults(defineProps<Props>(), {
  chapterTitle: undefined,
  markdownContent: '',
  bookId: undefined,
  chapterIndex: undefined,
  currentTime: 0,
  sentenceTimings: null,
})

const emit = defineEmits<{
  (e: 'selection-action', payload: ReaderSelectionActionPayload): void
}>()

const readingSettings = useReadingSettingsStore()
const readerRef = ref<HTMLElement | null>(null)
const actionSurfaceRef = ref<HTMLElement | null>(null)
const currentSelectionRange = ref<Range | null>(null)
const selectedText = ref('')
const isActionSurfaceVisible = ref(false)
const isMobileViewport = ref(false)
const surfacePosition = ref({ x: 0, y: 0 })
const isLookupDialogOpen = ref(false)
const activeSentenceKey = ref<string | null>(null)
const userScrollPauseUntil = ref(0)
const isProgrammaticScroll = ref(false)
const sentenceElementMap = new Map<string, HTMLElement>()
let scrollGuardTimer: ReturnType<typeof setTimeout> | null = null

const SENTENCE_SWITCH_HYSTERESIS_MS = 120
const AUTO_FOLLOW_VIEWPORT_RATIO = 0.48
const AUTO_FOLLOW_TOLERANCE_PX = 56
const AUTO_FOLLOW_USER_SCROLL_PAUSE_MS = 2500

const lookupState = ref<{
  status: 'idle' | 'loading' | 'success' | 'error'
  result: DictionaryEntry | null
  errorMessage: string | null
}>({
  status: 'idle',
  result: null,
  errorMessage: null,
})

const { playWordAudio, isWordAudioLoading } = useWordAudio()

const contentStyle = computed(() => ({
  fontSize: readingSettings.fontSizeCss,
  lineHeight: readingSettings.lineHeightCss,
}))

const normalizedSelection = computed(() => normalizeSelectionText(selectedText.value))

const lookupContext = computed<DictionaryLookupContext | undefined>(() => {
  const context: DictionaryLookupContext = {}

  if (typeof props.bookId === 'number' && Number.isFinite(props.bookId)) {
    context.bookId = props.bookId
  }

  if (typeof props.chapterIndex === 'number' && Number.isFinite(props.chapterIndex)) {
    context.chapterIndex = props.chapterIndex
  }

  return Object.keys(context).length > 0 ? context : undefined
})

const isLookupEligible = computed(() => {
  return isSingleWordSelection(selectedText.value, currentSelectionRange.value)
})

const paragraphSentenceTimings = computed(() => {
  if (!props.sentenceTimings?.length) {
    return [] as Array<{
      paragraphIndex: number
      sentences: ChapterSentenceTiming[]
    }>
  }

  const grouped = new Map<number, ChapterSentenceTiming[]>()
  for (const sentence of props.sentenceTimings) {
    const list = grouped.get(sentence.paragraphIndex) || []
    list.push(sentence)
    grouped.set(sentence.paragraphIndex, list)
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([paragraphIndex, sentences]) => ({
      paragraphIndex,
      sentences: [...sentences].sort((a, b) => a.sentenceIndex - b.sentenceIndex),
    }))
})

const titleSentenceTimings = computed(() => {
  if (!props.sentenceTimings?.length) {
    return [] as ChapterSentenceTiming[]
  }

  return props.sentenceTimings
    .filter((sentence) => sentence.isTitle)
    .sort((a, b) => a.sentenceIndex - b.sentenceIndex)
})

const bodyParagraphSentenceTimings = computed(() => {
  return paragraphSentenceTimings.value.filter((paragraph) => paragraph.paragraphIndex >= 0)
})

const computeTimelineActiveSentence = (currentMs: number) => {
  if (!props.sentenceTimings?.length) {
    return null
  }

  const inRangeCandidates = props.sentenceTimings.filter((sentence) => {
    if (sentence.startMs === null || sentence.endMs === null) {
      return false
    }
    return currentMs >= sentence.startMs && currentMs <= sentence.endMs
  })

  const active = inRangeCandidates.sort((a, b) => (b.startMs || 0) - (a.startMs || 0))[0]
    || props.sentenceTimings
      .filter((sentence) => sentence.startMs !== null && currentMs >= (sentence.startMs || 0))
      .sort((a, b) => (b.startMs || 0) - (a.startMs || 0))[0]

  return active ? `${active.paragraphIndex}-${active.sentenceIndex}` : null
}

const getSentenceKey = (sentence: ChapterSentenceTiming) => {
  return `${sentence.paragraphIndex}-${sentence.sentenceIndex}`
}

const getSortedTimedSentences = () => {
  return (props.sentenceTimings || [])
    .filter((sentence) => sentence.startMs !== null && sentence.endMs !== null)
    .slice()
    .sort((a, b) => {
      if ((a.startMs || 0) !== (b.startMs || 0)) {
        return (a.startMs || 0) - (b.startMs || 0)
      }
      if (a.paragraphIndex !== b.paragraphIndex) {
        return a.paragraphIndex - b.paragraphIndex
      }
      return a.sentenceIndex - b.sentenceIndex
    })
}

const applySentenceSwitchHysteresis = (candidateKey: string | null, currentMs: number) => {
  const currentKey = activeSentenceKey.value
  if (!candidateKey || !currentKey || candidateKey === currentKey) {
    return candidateKey
  }

  const timedSentences = getSortedTimedSentences()
  const nextIndex = timedSentences.findIndex((sentence) => getSentenceKey(sentence) === candidateKey)
  if (nextIndex <= 0) {
    return candidateKey
  }

  const nextSentence = timedSentences[nextIndex]
  const previousSentence = timedSentences[nextIndex - 1]
  if (!nextSentence || !previousSentence) {
    return candidateKey
  }

  if (getSentenceKey(previousSentence) !== currentKey) {
    return candidateKey
  }

  const nextStart = nextSentence.startMs || 0
  const previousEnd = previousSentence.endMs || 0
  const canKeepPrevious = currentMs < nextStart + SENTENCE_SWITCH_HYSTERESIS_MS
    && currentMs <= previousEnd + SENTENCE_SWITCH_HYSTERESIS_MS

  return canKeepPrevious ? currentKey : candidateKey
}

const registerSentenceElement = (
  sentence: ChapterSentenceTiming,
  element: unknown
) => {
  const key = getSentenceKey(sentence)
  if (element instanceof HTMLElement) {
    sentenceElementMap.set(key, element)
    return
  }
  sentenceElementMap.delete(key)
}

const pauseAutoFollowAfterUserScroll = () => {
  if (isProgrammaticScroll.value) {
    return
  }
  userScrollPauseUntil.value = Date.now() + AUTO_FOLLOW_USER_SCROLL_PAUSE_MS
}

const followActiveSentence = async () => {
  if (!activeSentenceKey.value || Date.now() < userScrollPauseUntil.value) {
    return
  }

  await nextTick()
  const activeElement = sentenceElementMap.get(activeSentenceKey.value)
  if (!activeElement) {
    return
  }

  const rect = activeElement.getBoundingClientRect()
  const viewportTargetY = window.innerHeight * AUTO_FOLLOW_VIEWPORT_RATIO
  const sentenceCenterY = rect.top + rect.height / 2
  const deltaY = sentenceCenterY - viewportTargetY
  if (Math.abs(deltaY) <= AUTO_FOLLOW_TOLERANCE_PX) {
    return
  }

  isProgrammaticScroll.value = true
  try {
    window.scrollBy({
      top: deltaY,
      behavior: 'smooth',
    })
  } catch {
    isProgrammaticScroll.value = false
    return
  }

  if (scrollGuardTimer) {
    clearTimeout(scrollGuardTimer)
  }
  scrollGuardTimer = setTimeout(() => {
    isProgrammaticScroll.value = false
    scrollGuardTimer = null
  }, 320)
}

const isSentenceActive = (sentence: ChapterSentenceTiming) => {
  return activeSentenceKey.value === getSentenceKey(sentence)
}

const resetLookupState = () => {
  lookupState.value = {
    status: 'idle',
    result: null,
    errorMessage: null,
  }
}

const closeActionSurface = () => {
  isActionSurfaceVisible.value = false
  currentSelectionRange.value = null
  selectedText.value = ''
  resetLookupState()
  isLookupDialogOpen.value = false
}

const updateViewportMode = () => {
  isMobileViewport.value = window.matchMedia('(max-width: 767px)').matches
}

const isSelectionInReader = (selection: Selection) => {
  if (!readerRef.value || selection.rangeCount === 0) {
    return false
  }

  const range = selection.getRangeAt(0)
  return readerRef.value.contains(range.commonAncestorContainer)
}

const updateSelectionState = () => {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    closeActionSurface()
    return
  }

  if (!isSelectionInReader(selection)) {
    closeActionSurface()
    return
  }

  const text = selection.toString().trim()
  if (!text) {
    closeActionSurface()
    return
  }

  const range = selection.getRangeAt(0).cloneRange()
  const rect = typeof range.getBoundingClientRect === 'function'
    ? range.getBoundingClientRect()
    : {
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
      width: 0,
    }

  currentSelectionRange.value = range
  selectedText.value = text
  isLookupDialogOpen.value = false
  surfacePosition.value = {
    x: rect.left + rect.width / 2,
    y: rect.top - 12,
  }
  isActionSurfaceVisible.value = true
  resetLookupState()
}

const emitSelectionAction = (actionType: ReaderActionType) => {
  emit('selection-action', {
    actionType,
    selectedText: normalizedSelection.value,
    selectionMeta: {
      anchorX: surfacePosition.value.x,
      anchorY: surfacePosition.value.y,
    },
  })
}

const getExampleSourceLabel = (source: DictionaryExample['source']) => {
  const labelMap: Record<DictionaryExample['source'], string> = {
    dictionary: '词典',
    article: '文章',
    ai: 'AI',
  }

  return labelMap[source]
}

const getMetaLabel = (source?: DictionaryEntry['meta'] | null) => {
  if (!source) {
    return ''
  }

  const labelMap: Record<NonNullable<DictionaryEntry['meta']>['source'], string> = {
    dictionary: '词典',
    dictionary_plus_ai: '词典增强',
    ai_fallback: 'AI 兜底',
  }

  return labelMap[source.source]
}

const handleLookup = async () => {
  if (!isLookupEligible.value) {
    toast.error('查词仅支持一个完整英文单词')
    return
  }

  lookupState.value = { status: 'loading', result: null, errorMessage: null }
  isLookupDialogOpen.value = true
  await lookupWord(normalizedSelection.value, lookupContext.value)
    .then((result) => {
      lookupState.value = {
        status: 'success',
        result,
        errorMessage: null,
      }
    })
    .catch((error: DictionaryLookupError) => {
      lookupState.value = {
        status: 'error',
        result: null,
        errorMessage: error.message,
      }
    })
}

const handleActionClick = async (actionType: ReaderActionType) => {
  if (!selectedText.value) {
    return
  }

  if (selectedText.value.length > READER_SELECTION.MAX_LENGTH) {
    toast.error(`选中文本不能超过 ${READER_SELECTION.MAX_LENGTH} 字`)
    return
  }

  if (actionType === 'lookup') {
    await handleLookup()
    return
  }

  emitSelectionAction(actionType)
  closeActionSurface()
}

const handleCopyAction = async () => {
  if (!normalizedSelection.value) {
    return
  }

  try {
    const clipboard = navigator.clipboard
    if (!clipboard?.writeText) {
      throw new Error('clipboard-unavailable')
    }
    await clipboard.writeText(normalizedSelection.value)
    toast.success('已复制')
  } catch {
    toast.error('复制失败，请重试')
  }
}

const handleEscapeClose = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeActionSurface()
  }
}

const handleOutsideClick = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!target) {
    return
  }

  if (actionSurfaceRef.value?.contains(target)) {
    return
  }

  if (readerRef.value?.contains(target)) {
    return
  }

  closeActionSurface()
}

onMounted(() => {
  updateViewportMode()
  window.addEventListener('resize', updateViewportMode)
  window.addEventListener('wheel', pauseAutoFollowAfterUserScroll, { passive: true })
  window.addEventListener('touchmove', pauseAutoFollowAfterUserScroll, { passive: true })
  document.addEventListener('selectionchange', updateSelectionState)
  document.addEventListener('keydown', handleEscapeClose)
  document.addEventListener('mousedown', handleOutsideClick)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportMode)
  window.removeEventListener('wheel', pauseAutoFollowAfterUserScroll)
  window.removeEventListener('touchmove', pauseAutoFollowAfterUserScroll)
  document.removeEventListener('selectionchange', updateSelectionState)
  document.removeEventListener('keydown', handleEscapeClose)
  document.removeEventListener('mousedown', handleOutsideClick)
  if (scrollGuardTimer) {
    clearTimeout(scrollGuardTimer)
    scrollGuardTimer = null
  }
  sentenceElementMap.clear()
})

watch(
  () => [props.currentTime, props.sentenceTimings] as const,
  ([currentTime]) => {
    const currentMs = Math.round((currentTime || 0) * 1000)
    const candidateKey = computeTimelineActiveSentence(currentMs)
    activeSentenceKey.value = applySentenceSwitchHysteresis(candidateKey, currentMs)
  },
  { immediate: true, deep: true }
)

watch(
  () => activeSentenceKey.value,
  (nextKey, prevKey) => {
    if (!nextKey || nextKey === prevKey) {
      return
    }
    void followActiveSentence()
  }
)
</script>

<template>
  <div ref="readerRef" class="flex-1 min-h-0 flex flex-col">
    <div
      class="mx-auto w-full transition-all duration-300 py-8"
      :style="{
        maxWidth: readingSettings.contentWidthCss,
        ...contentStyle,
      }"
    >
      <h2
        v-if="props.chapterTitle && !props.markdownContent"
        class="text-2xl font-bold text-foreground mb-8"
      >
        {{ props.chapterTitle }}
      </h2>

      <div v-if="paragraphSentenceTimings.length" class="text-foreground space-y-6">
        <h2
          v-if="props.chapterTitle"
          class="text-2xl font-bold text-foreground"
        >
          <template v-if="titleSentenceTimings.length">
            <span
              v-for="sentence in titleSentenceTimings"
              :key="`title-${sentence.sentenceIndex}`"
              :ref="(el) => registerSentenceElement(sentence, el)"
              class="rounded px-1 py-0.5 transition-colors duration-200"
              :data-sentence-key="getSentenceKey(sentence)"
              :class="isSentenceActive(sentence)
                ? 'bg-amber-200/70 dark:bg-amber-400/30 text-foreground ring-1 ring-amber-300/40 dark:ring-amber-300/30'
                : ''"
            >
              {{ sentence.text }}{{ ' ' }}
            </span>
          </template>
          <template v-else>
            {{ props.chapterTitle }}
          </template>
        </h2>
        <p
          v-for="paragraph in bodyParagraphSentenceTimings"
          :key="paragraph.paragraphIndex"
          class="leading-8"
        >
          <span
            v-for="sentence in paragraph.sentences"
            :key="`${sentence.paragraphIndex}-${sentence.sentenceIndex}`"
            :ref="(el) => registerSentenceElement(sentence, el)"
            class="rounded px-1 py-0.5 transition-colors duration-200"
            :data-sentence-key="getSentenceKey(sentence)"
            :class="isSentenceActive(sentence)
              ? 'bg-amber-200/70 dark:bg-amber-400/30 text-foreground ring-1 ring-amber-300/40 dark:ring-amber-300/30'
              : ''"
            :data-test="isSentenceActive(sentence) ? 'reader-sentence-active' : undefined"
          >
            {{ sentence.text }}{{ ' ' }}
          </span>
        </p>
      </div>
      <div v-else-if="props.markdownContent" class="text-foreground">
        <MarkdownRenderer :content="props.markdownContent" />
      </div>
      <div v-else class="text-foreground">
        <p
          v-for="(paragraph, index) in paragraphs"
          :key="index"
          class="mb-6 last:mb-0 indent-0"
        >
          {{ paragraph }}
        </p>
      </div>
    </div>

    <div
      v-if="isActionSurfaceVisible"
      ref="actionSurfaceRef"
      data-test="reader-action-surface"
      class="z-50 rounded-[18px] border border-border/60 bg-background/95 text-foreground shadow-xs backdrop-blur-sm px-1.5 py-0.5"
      :class="isMobileViewport ? 'fixed inset-x-3 bottom-4' : 'fixed w-fit max-w-[calc(100vw-2rem)]'"
      :style="!isMobileViewport ? { left: `${surfacePosition.x}px`, top: `${surfacePosition.y}px`, transform: 'translate(-50%, -100%)' } : undefined"
    >
      <div class="flex items-center gap-px overflow-x-auto whitespace-nowrap">
        <Button
          data-test="reader-lookup-button"
          variant="ghost"
          size="sm"
          class="h-7 px-2 rounded-md text-[13px] font-normal text-foreground hover:bg-muted/80"
          @mousedown.prevent
          @click="handleActionClick('lookup')"
        >
          <Search class="size-3.5 mr-1" />
          查词
        </Button>
        <Button
          data-test="reader-explain-button"
          size="sm"
          variant="ghost"
          class="h-7 px-2 rounded-md text-[13px] font-normal text-foreground hover:bg-muted/80"
          @mousedown.prevent
          @click="handleActionClick('explain')"
        >
          <BookText class="size-3.5 mr-1" />
          解释
        </Button>
        <Button
          data-test="reader-translate-button"
          size="sm"
          variant="ghost"
          class="h-7 px-2 rounded-md text-[13px] font-normal text-foreground hover:bg-muted/80"
          @mousedown.prevent
          @click="handleActionClick('translate')"
        >
          <Languages class="size-3.5 mr-1" />
          翻译
        </Button>
        <div data-test="reader-lookup-divider" class="h-3.5 w-px shrink-0 bg-border/70 mx-0.5" />
        <Button
          data-test="reader-copy-button"
          size="sm"
          variant="ghost"
          class="h-7 px-2 rounded-md text-[13px] font-normal text-foreground hover:bg-muted/80"
          @mousedown.prevent
          @click="handleCopyAction"
        >
          <Copy class="size-3.5 mr-1" />
          复制
        </Button>
        <Button
          data-test="reader-qa-button"
          size="sm"
          variant="ghost"
          class="h-7 px-2 rounded-md text-[13px] font-normal text-foreground hover:bg-muted/80"
          @mousedown.prevent
          @click="handleActionClick('qa')"
        >
          <MessageCircleMore class="size-3.5 mr-1" />
          问问AI
        </Button>
      </div>

    </div>

    <Dialog v-model:open="isLookupDialogOpen">
      <DialogContent class="w-[min(42rem,calc(100vw-1.5rem))] h-[min(82vh,calc(100vh-1.5rem))] overflow-hidden p-0">
        <div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]" @mousedown.stop>
          <DialogHeader class="border-b px-5 py-4 text-left">
            <DialogTitle class="text-base font-semibold">
              查词结果
            </DialogTitle>
            <DialogDescription class="text-xs">
              {{ normalizedSelection }}
            </DialogDescription>
          </DialogHeader>

          <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <p
              v-if="lookupState.status === 'loading'"
              data-test="reader-lookup-loading"
              class="text-sm text-muted-foreground"
            >
              查词中...
            </p>

            <p
              v-else-if="lookupState.status === 'error'"
              data-test="reader-lookup-error"
              class="text-sm text-destructive"
            >
              {{ lookupState.errorMessage }}
            </p>

            <div
              v-else-if="lookupState.status === 'success' && lookupState.result"
              data-test="reader-lookup-result"
              class="space-y-5 text-sm"
            >
              <div class="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-xl font-semibold leading-tight text-foreground">
                      {{ lookupState.result.word }}
                    </p>
                    <Button
                      v-if="lookupState.result.word"
                      variant="ghost"
                      size="icon"
                      class="size-7 shrink-0"
                      :disabled="isWordAudioLoading(lookupState.result.word)"
                      @click="playWordAudio(lookupState.result.word)"
                    >
                      <Loader2
                        v-if="isWordAudioLoading(lookupState.result.word)"
                        class="size-4 animate-spin"
                      />
                      <Volume2 v-else class="size-4" />
                    </Button>
                  </div>
                  <p v-if="lookupState.result.phonetic" class="mt-1 text-sm text-muted-foreground">
                    {{ lookupState.result.phonetic }}
                  </p>
                </div>
                <span
                  v-if="lookupState.result.meta"
                  class="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {{ getMetaLabel(lookupState.result.meta) }}
                </span>
              </div>

              <div class="divide-y divide-border/60">
                <section
                  v-for="(meaning, meaningIndex) in lookupState.result.meanings.slice(0, 3)"
                  :key="`${meaning.partOfSpeech}-${meaningIndex}`"
                  class="py-4 first:pt-0 last:pb-0"
                >
                  <div class="flex flex-wrap items-baseline gap-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {{ meaning.partOfSpeech }}
                    </p>
                    <p v-if="meaning.localizedMeaning" class="text-sm font-medium text-foreground">
                      {{ meaning.localizedMeaning }}
                    </p>
                  </div>

                  <p class="mt-2 leading-6 text-foreground/90">
                    {{ meaning.explanation }}
                  </p>

                  <div
                    v-if="getMeaningExamples(meaning).length > 0"
                    class="mt-3 space-y-3 border-l border-border/60 pl-4"
                  >
                    <div
                      v-for="(example, exampleIndex) in getMeaningExamples(meaning).slice(0, 2)"
                      :key="`${meaningIndex}-${exampleIndex}-${example.source}`"
                      class="space-y-1"
                    >
                      <div class="flex items-center gap-2">
                        <p class="text-xs text-muted-foreground">
                          例句
                        </p>
                        <span class="text-[11px] text-muted-foreground">
                          {{ getExampleSourceLabel(example.source) }}
                        </span>
                      </div>
                      <p class="leading-6 text-foreground">
                        {{ example.sourceText }}
                      </p>
                      <p v-if="example.localizedText" class="leading-6 text-muted-foreground">
                        {{ example.localizedText }}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
