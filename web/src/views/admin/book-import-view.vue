<script setup lang="ts">
import { Upload, FileText, CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { adminApi, type ParsedBookPreview } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { useBookImportStatus } from '@/composables/useBookImportStatus'

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

const {
  status,
  isConnected,
  trackingBookId,
  refreshStatus,
  startTracking,
  stopTracking,
} = useBookImportStatus()

const PROCESSING_STEP_LABELS: Record<string, string> = {
  parsing: '解析内容',
  analyzing_vocabulary: '分析词汇',
  generating_meanings: '生成释义',
  generating_audio: '生成音频',
  audio_queued: '音频任务排队中',
  audio: '音频处理中',
  completed: '处理完成'
}

function getProcessingStepLabel(step: string | null) {
  if (!step) {
    return '处理中'
  }

  return PROCESSING_STEP_LABELS[step] || '处理中'
}

const progressText = computed(() => {
  if (!status.value) {
    return '等待开始处理'
  }

  if (status.value.status === 'failed') {
    return status.value.processingError || '处理失败'
  }

  if (status.value.status === 'ready') {
    return '处理完成'
  }

  return `${getProcessingStepLabel(status.value.processingStep)}（${status.value.processingProgress}%）`
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
    toast.error((error as Error).message || '解析文件失败')
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
    toast.error('请输入书名')
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

    await startTracking(result.bookId)
    step.value = 3
  } catch (error) {
    toast.error((error as Error).message || '导入书籍失败')
  } finally {
    isImporting.value = false
  }
}

function handleRefreshStatus() {
  if (!trackingBookId.value) {
    return
  }
  refreshStatus()
}

function resetFlow() {
  step.value = 1
  file.value = null
  preview.value = null
  stopTracking()
}

watch(status, (newStatus, oldStatus) => {
  if (!newStatus) {
    return
  }

  if (newStatus.status === 'processing') {
    step.value = 3
    return
  }

  if (newStatus.status === 'failed') {
    if (oldStatus?.status === 'processing') {
      toast.error(newStatus.processingError || '书籍导入失败')
    }
  }

  if (newStatus.status === 'ready') {
    if (oldStatus?.status === 'processing') {
      toast.success('书籍导入完成')
    }
  }

  resetFlow()
})

onMounted(async () => {
  if (trackingBookId.value) {
    await refreshStatus()
    if (status.value?.status === 'processing') {
      step.value = 3
      return
    }

    await stopTracking()
  }
})
</script>

<template>
  <div class="container mx-auto max-w-4xl px-4 py-8">
    <Card>
      <CardHeader>
        <CardTitle>导入书籍</CardTitle>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge :variant="step >= 1 ? 'default' : 'outline'">1. 上传</Badge>
          <Badge :variant="step >= 2 ? 'default' : 'outline'">2. 预览</Badge>
          <Badge :variant="step >= 3 ? 'default' : 'outline'">3. 进度</Badge>
        </div>

        <div v-if="step === 1" class="space-y-4">
          <label
            class="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center"
          >
            <Upload class="mb-3 size-8 text-muted-foreground" />
            <p class="font-medium">拖拽文件到此处或点击上传</p>
            <p class="mt-1 text-sm text-muted-foreground">仅支持 .epub 和 .txt，最大 4MB</p>
            <input class="hidden" type="file" accept=".epub,.txt" @change="onFileChange" />
          </label>

          <div v-if="isParsing" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" />
            正在解析文件...
          </div>
        </div>

        <div v-else-if="step === 2 && preview" class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2 md:col-span-2">
              <Label>书名</Label>
              <Input v-model="form.title" />
            </div>
            <div class="space-y-2">
              <Label>作者</Label>
              <Input v-model="form.author" />
            </div>
            <div class="space-y-2">
              <Label>难度</Label>
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
              <Label>简介</Label>
              <Textarea v-model="form.description" :rows="3" />
            </div>
          </div>

          <div class="rounded-md border p-3">
            <div class="mb-2 flex items-center gap-2 text-sm">
              <FileText class="size-4" />
              <span>{{ preview.fileName }}</span>
              <span class="text-muted-foreground">· {{ preview.wordCount }} 词</span>
            </div>
            <div class="max-h-52 space-y-2 overflow-auto text-sm">
              <div v-for="chapter in preview.chapters" :key="chapter.chapterIndex" class="rounded bg-muted/30 px-2 py-1">
                {{ chapter.chapterIndex + 1 }}. {{ chapter.title }}
              </div>
            </div>
          </div>

          <div class="flex gap-3">
            <Button variant="outline" @click="step = 1">返回</Button>
            <Button :disabled="isImporting" @click="confirmImport">
              <Loader2 v-if="isImporting" class="mr-2 size-4 animate-spin" />
              导入
            </Button>
          </div>
        </div>

        <div v-else-if="step === 3" class="space-y-4">
          <div class="rounded-md border p-4">
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <CheckCircle2 v-if="status?.status === 'ready'" class="size-5 text-green-600" />
                <Loader2 v-else-if="status?.status === 'processing'" class="size-5 animate-spin text-primary" />
                <span class="font-medium">书籍 #{{ trackingBookId || '-' }}</span>
              </div>
              <div class="flex items-center gap-1 text-xs">
                <Wifi v-if="isConnected" class="size-3 text-green-600" />
                <WifiOff v-else class="size-3 text-muted-foreground" />
                <span :class="isConnected ? 'text-green-600' : 'text-muted-foreground'">
                  {{ isConnected ? '实时连接' : '重连中' }}
                </span>
              </div>
            </div>
            <Progress :model-value="status?.processingProgress || 0" />
            <p class="mt-2 text-sm text-muted-foreground">{{ progressText }}</p>
            <p v-if="status?.processingError" class="mt-2 text-sm text-destructive">{{ status.processingError }}</p>
          </div>

          <div class="flex gap-3">
            <Button variant="outline" @click="handleRefreshStatus">刷新状态</Button>
            <Button variant="outline" @click="resetFlow">继续导入</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
