<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

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

marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
  mangle: false,
})

const renderer = new marked.Renderer()
renderer.code = (code: string, language?: string) => {
  const validLanguage = language && hljs.getLanguage(language) ? language : 'plaintext'
  const highlighted = hljs.highlight(code, { language: validLanguage }).value
  return `
    <div class="relative group">
      <div class="flex items-center justify-between px-4 py-2 bg-muted/80 border-b border-border rounded-t-lg">
        <span class="text-xs font-mono text-muted-foreground">${validLanguage}</span>
        <button 
          class="copy-btn flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground bg-background/50 hover:bg-background rounded transition-colors"
          data-code="${encodeURIComponent(code)}"
        >
          <span class="copy-icon">复制</span>
        </button>
      </div>
      <pre class="m-0 rounded-t-none rounded-b-lg"><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
    </div>
  `
}

const renderedHtml = computed(() => {
  const rawHtml = marked(displayedContent.value, { renderer })
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
      'class', 'data-code',
    ],
  })
})

const startTypewriter = () => {
  if (typewriterTimer) {
    clearTimeout(typewriterTimer)
  }

  const fullContent = props.content
  displayedContent.value = ''
  isTyping.value = true
  let charIndex = 0

  const typeNextChar = () => {
    if (charIndex < fullContent.length) {
      const charsToType = Math.min(3, fullContent.length - charIndex)
      displayedContent.value += fullContent.slice(charIndex, charIndex + charsToType)
      charIndex += charsToType
      typewriterTimer = setTimeout(typeNextChar, props.streamingSpeed)
    } else {
      isTyping.value = false
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
      }
    } else if (newContent.length > (oldContent?.length || 0)) {
      if (!isTyping.value && displayedContent.value.length < newContent.length) {
        startTypewriter()
      }
    }
  },
  { immediate: true }
)

const contentRef = ref<HTMLElement>()

const handleCopyClick = async (event: Event) => {
  const target = event.target as HTMLElement
  const button = target.closest('.copy-btn') as HTMLButtonElement
  if (!button) return

  const code = decodeURIComponent(button.dataset.code || '')
  if (!code) return

  try {
    await navigator.clipboard.writeText(code)
    
    const icon = button.querySelector('.copy-icon')
    if (icon) {
      icon.textContent = '已复制'
      button.classList.add('text-green-600')
      
      setTimeout(() => {
        icon.textContent = '复制'
        button.classList.remove('text-green-600')
      }, 2000)
    }
  } catch (err) {
    console.error('Failed to copy code:', err)
  }
}

onMounted(() => {
  if (contentRef.value) {
    contentRef.value.addEventListener('click', handleCopyClick)
  }
})

onUnmounted(() => {
  if (typewriterTimer) {
    clearTimeout(typewriterTimer)
  }
  if (contentRef.value) {
    contentRef.value.removeEventListener('click', handleCopyClick)
  }
})
</script>

<template>
  <div 
    ref="contentRef"
    class="markdown-body prose prose-sm dark:prose-invert max-w-none"
    v-html="renderedHtml"
  />
</template>

<style scoped>
:deep(.markdown-body) {
  @apply text-sm leading-relaxed;
}

:deep(.markdown-body p) {
  @apply mb-3 last:mb-0;
}

:deep(.markdown-body h1) {
  @apply text-xl font-bold mb-3 mt-4 first:mt-0;
}

:deep(.markdown-body h2) {
  @apply text-lg font-semibold mb-2 mt-3 first:mt-0;
}

:deep(.markdown-body h3) {
  @apply text-base font-semibold mb-2 mt-3 first:mt-0;
}

:deep(.markdown-body ul, .markdown-body ol) {
  @apply mb-3 pl-5;
}

:deep(.markdown-body li) {
  @apply mb-1;
}

:deep(.markdown-body ul) {
  @apply list-disc;
}

:deep(.markdown-body ol) {
  @apply list-decimal;
}

:deep(.markdown-body blockquote) {
  @apply border-l-2 border-muted pl-3 italic text-muted-foreground my-3;
}

:deep(.markdown-body code:not(pre code)) {
  @apply px-1.5 py-0.5 bg-muted rounded text-xs font-mono;
}

:deep(.markdown-body pre) {
  @apply bg-muted rounded-lg p-3 overflow-x-auto my-3;
}

:deep(.markdown-body pre code) {
  @apply bg-transparent p-0 text-xs leading-relaxed;
}

:deep(.markdown-body a) {
  @apply text-primary underline underline-offset-2 hover:text-primary/80;
}

:deep(.markdown-body table) {
  @apply w-full border-collapse my-3;
}

:deep(.markdown-body th, .markdown-body td) {
  @apply border border-border px-3 py-2 text-left text-xs;
}

:deep(.markdown-body th) {
  @apply bg-muted font-medium;
}

:deep(.markdown-body .group:hover .copy-btn) {
  @apply opacity-100;
}

:deep(.markdown-body .copy-btn) {
  @apply opacity-0 transition-opacity duration-200;
}

@media (max-width: 640px) {
  :deep(.markdown-body .copy-btn) {
    @apply opacity-100;
  }
}
</style>
