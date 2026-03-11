<script setup lang="ts">
import { Upload, FileText, CheckCircle2, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { adminApi, type ParsedBookPreview } from '@/api/admin'
import type { BookStatusResponse } from '@/types/book'
import { useAuthStore } from '@/stores/auth'
import { useBookImportSse } from '@/composables/useBookImportSse'

const authStore = useAuthStore()
const userId = authStore.user?.id

if (!userId) {
  throw new Error('User not found')
}

const step = ref<1 | 2 | 3>(1)
const isParsing = ref(false)
const isImporting = ref(false)
const preview = ref<ParsedBookPreview | null>(null)
const file = ref<File | null>(null)

const form = reactive({
  title: '',
  author: '',
  description: '',
  source: 'user_uploaded' as 'user_uploaded' | 'public_domain' | 'ai_generated',
  difficultyLevel: 'L1' as 'L1' | 'L2' | 'L3',
})

const status = ref<BookStatusResponse | null>(null)

const {
  event,
  trackingBookId,
  setTrackingBookId,
  clearTracking,
  subscribe,
  unsubscribe,
} = useBookImportSse(userId)

const progressText = computed(() => {
  if (!status.value) {
    return 'Waiting to start'
  }

  if (status.value.status === 'failed') {
    return status.value.processingError || 'Processing failed'
  }

  if (status.value.status === 'ready') {
    return 'Completed'
  }

  return `${status.value.processingStep || 'processing'} (${status.value.processingProgress}%)`
})

async function parseSelectedFile(selected: File) {
  isParsing.value = true
  try {
    const result = await adminApi.parseBookFile(selected)
    preview.value = result
    form.title = result.title
    form.author = result.author || ''
    form.description = result.description || ''
    step.value = 2
  } catch (error) {
    toast.error((error as Error).message || 'Failed to parse file')
  } finally {
    isParsing.value = false
  }
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const selected = target.files?.[0]
  if (!selected) {
    return
  }

  file.value = selected
  parseSelectedFile(selected)
}

async function confirmImport() {
  if (!preview.value) {
    return
  }

  if (!form.title.trim()) {
    toast.error('Please input title')
    return
  }

  isImporting.value = true

  try {
    const result = await adminApi.importBook({
      title: form.title.trim(),
      author: form.author.trim(),
      description: form.description.trim(),
      source: form.source,
      difficultyLevel: form.difficultyLevel,
      wordCount: preview.value.wordCount,
      chapters: preview.value.chapters.map((chapter) => ({
        title: chapter.title,
        content: chapter.content,
      })),
    })

    setTrackingBookId(result.bookId)
    status.value = await adminApi.getBookStatus(result.bookId)
    step.value = 3
  } catch (error) {
    toast.error((error as Error).message || 'Failed to import book')
  } finally {
    isImporting.value = false
  }
}

async function refreshStatus() {
  if (!trackingBookId.value) {
    return false
  }

  try {
    status.value = await adminApi.getBookStatus(trackingBookId.value)
    return true
  } catch (error) {
    toast.error((error as Error).message || 'Failed to query status')
    // 接口失败时重置流程，让用户可以重新上传
    resetFlow()
    return false
  }
}

function resetFlow() {
  step.value = 1
  file.value = null
  preview.value = null
  status.value = null
  clearTracking()
}

watch(event, (payload) => {
  if (!payload) {
    return
  }

  status.value = {
    id: payload.bookId,
    status: payload.status,
    processingStep: payload.processingStep,
    processingProgress: payload.processingProgress,
    processingError: payload.processingError || null,
  }
  step.value = 3

  if (payload.status === 'failed') {
    toast.error(payload.processingError || payload.message || 'Book import failed')
  }

  if (payload.status === 'ready') {
    toast.success('Book import completed')
  }
})

onMounted(async () => {
  await subscribe()
  if (trackingBookId.value) {
    const success = await refreshStatus()
    if (success) {
      step.value = 3
    }
  }
})

onUnmounted(() => {
  unsubscribe()
})
</script>

<template>
  <div class="container mx-auto max-w-4xl px-4 py-8">
    <Card>
      <CardHeader>
        <CardTitle>Import Book</CardTitle>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge :variant="step >= 1 ? 'default' : 'outline'">1. Upload</Badge>
          <Badge :variant="step >= 2 ? 'default' : 'outline'">2. Preview</Badge>
          <Badge :variant="step >= 3 ? 'default' : 'outline'">3. Progress</Badge>
        </div>

        <div v-if="step === 1" class="space-y-4">
          <label
            class="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center"
          >
            <Upload class="mb-3 size-8 text-muted-foreground" />
            <p class="font-medium">Drag file here or click to upload</p>
            <p class="mt-1 text-sm text-muted-foreground">Only .epub and .txt, max 4MB</p>
            <input class="hidden" type="file" accept=".epub,.txt" @change="onFileChange" />
          </label>

          <div v-if="isParsing" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" />
            Parsing file...
          </div>
        </div>

        <div v-else-if="step === 2 && preview" class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input v-model="form.title" />
            </div>
            <div class="space-y-2">
              <Label>Author</Label>
              <Input v-model="form.author" />
            </div>
            <div class="space-y-2">
              <Label>Difficulty</Label>
              <Select v-model="form.difficultyLevel">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">L1</SelectItem>
                  <SelectItem value="L2">L2</SelectItem>
                  <SelectItem value="L3">L3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea v-model="form.description" :rows="3" />
            </div>
          </div>

          <div class="rounded-md border p-3">
            <div class="mb-2 flex items-center gap-2 text-sm">
              <FileText class="size-4" />
              <span>{{ preview.fileName }}</span>
              <span class="text-muted-foreground">· {{ preview.wordCount }} words</span>
            </div>
            <div class="max-h-52 space-y-2 overflow-auto text-sm">
              <div v-for="chapter in preview.chapters" :key="chapter.chapterIndex" class="rounded bg-muted/30 px-2 py-1">
                {{ chapter.chapterIndex + 1 }}. {{ chapter.title }}
              </div>
            </div>
          </div>

          <div class="flex gap-3">
            <Button variant="outline" @click="step = 1">Back</Button>
            <Button :disabled="isImporting" @click="confirmImport">
              <Loader2 v-if="isImporting" class="mr-2 size-4 animate-spin" />
              Import
            </Button>
          </div>
        </div>

        <div v-else-if="step === 3" class="space-y-4">
          <div class="rounded-md border p-4">
            <div class="mb-2 flex items-center gap-2">
              <CheckCircle2 v-if="status?.status === 'ready'" class="size-5 text-green-600" />
              <Loader2 v-else-if="status?.status === 'processing'" class="size-5 animate-spin text-primary" />
              <span class="font-medium">Book #{{ trackingBookId || '-' }}</span>
            </div>
            <Progress :model-value="status?.processingProgress || 0" />
            <p class="mt-2 text-sm text-muted-foreground">{{ progressText }}</p>
            <p v-if="status?.processingError" class="mt-2 text-sm text-destructive">{{ status.processingError }}</p>
          </div>

          <div class="flex gap-3">
            <Button variant="outline" @click="refreshStatus">Refresh Status</Button>
            <Button variant="outline" @click="resetFlow">Import Another</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
