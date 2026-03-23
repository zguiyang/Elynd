<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { getNextStreamingText, hasPendingStreamingText } from '@/lib/streaming-text'

interface Props {
  content: string
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
})

const displayedContent = ref('')
let streamingTimer: ReturnType<typeof setTimeout> | null = null

marked.use({
  gfm: true,
  breaks: false,
})

const renderedHtml = computed(() => {
  const rawHtml = marked.parse(props.content) as string
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'code', 'pre',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel',
      'src', 'alt', 'title',
      'class',
    ],
  })
})

watch(
  () => props.content,
  (newContent, oldContent) => {
    if (!props.isStreaming) {
      displayedContent.value = newContent
      if (streamingTimer) {
        clearTimeout(streamingTimer)
        streamingTimer = null
      }
      return
    }

    if (newContent === oldContent) {
      return
    }

    if (streamingTimer) {
      return
    }

    const streamNextBatch = () => {
      if (!hasPendingStreamingText(displayedContent.value, props.content)) {
        streamingTimer = null
        return
      }

      displayedContent.value = getNextStreamingText(displayedContent.value, props.content, 8)
      streamingTimer = setTimeout(streamNextBatch, 24)
    }

    streamNextBatch()
  },
  { immediate: true }
)

onUnmounted(() => {
  if (streamingTimer) {
    clearTimeout(streamingTimer)
  }
})

</script>

<template>
  <div v-if="isStreaming" class="flex items-end gap-1">
    <div class="max-w-none whitespace-pre-wrap break-words leading-7 text-[15px]">
      {{ displayedContent }}
    </div>
    <span
      class="mb-1 inline-block h-4 w-0.5 shrink-0 rounded-full bg-primary/70 animate-pulse"
      aria-hidden="true"
    />
  </div>
  <div
    v-else
    class="markdown-body prose prose-sm dark:prose-invert max-w-none"
    v-html="renderedHtml"
  />
</template>

<style scoped>
.markdown-body {
  /* Styles moved to global styles.css */
}
</style>
