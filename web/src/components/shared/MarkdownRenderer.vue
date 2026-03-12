<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { getNextTypewriterContent, hasPendingTypewriterChars } from '@/lib/streaming-typewriter'

interface Props {
  content: string
  isStreaming?: boolean
  streamingSpeed?: number
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  streamingSpeed: 30,
})

const displayedContent = ref('')
const isTyping = ref(false)
let typewriterTimer: ReturnType<typeof setTimeout> | null = null

marked.use({
  gfm: true,
  breaks: true,
})

const renderedHtml = computed(() => {
  const rawHtml = marked.parse(displayedContent.value) as string
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

const startTypewriter = () => {
  if (typewriterTimer) {
    clearTimeout(typewriterTimer)
  }

  if (!hasPendingTypewriterChars(displayedContent.value, props.content)) {
    isTyping.value = false
    return
  }

  isTyping.value = true

  const typeNextChar = () => {
    if (hasPendingTypewriterChars(displayedContent.value, props.content)) {
      displayedContent.value = getNextTypewriterContent(
        displayedContent.value,
        props.content,
        3
      )
      typewriterTimer = setTimeout(typeNextChar, props.streamingSpeed)
    } else {
      isTyping.value = false
      typewriterTimer = null
    }
  }

  typeNextChar()
}

watch(
  () => props.content,
  (newContent, oldContent) => {
    if (!props.isStreaming) {
      displayedContent.value = newContent
      isTyping.value = false
      if (typewriterTimer) {
        clearTimeout(typewriterTimer)
        typewriterTimer = null
      }
    } else if (newContent.length > (oldContent?.length || 0)) {
      if (!isTyping.value && hasPendingTypewriterChars(displayedContent.value, newContent)) {
        startTypewriter()
      }
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (typewriterTimer) {
    clearTimeout(typewriterTimer)
  }
})
</script>

<template>
  <div
    class="markdown-body prose prose-sm dark:prose-invert max-w-none"
    v-html="renderedHtml"
  />
</template>

<style scoped>
.markdown-body {
  /* Styles moved to global styles.css */
}
</style>
