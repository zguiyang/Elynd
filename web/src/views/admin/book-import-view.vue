<script setup lang="ts">
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { adminApi, type ParsedBookPreview } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
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
const bookHash = ref<string>('')

// Error state for inline display
const submitError = ref<string | null>(null)

const form = reactive({
  title: '',
  author: '',
  description: '',
  source: 'user_uploaded' as 'user_uploaded' | 'public_domain' | 'ai_generated',
  difficultyLevel: 'L1' as 'L1' | 'L2' | 'L3',
})

/**
 * Compute SHA-256 hash of file content for traceability
 */
async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function parseSelectedFile(selected: File) {
  isParsing.value = true
  submitError.value = null
  try {
    // Compute file hash for traceability
    bookHash.value = await computeFileHash(selected)

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

  if (!bookHash.value) {
    toast.error('文件哈希计算失败')
    return
  }

  isImporting.value = true
  submitError.value = null

  try {
    await adminApi.importBook({
      title: form.title.trim(),
      author: form.author.trim(),
      description: form.description.trim(),
      source: form.source,
      difficultyLevel: form.difficultyLevel,
      wordCount: preview.value.wordCount,
      bookHash: bookHash.value,
      chapters: preview.value.chapters.map((chapter) => ({
        title: chapter.title,
        content: chapter.content,
      })),
    })

    // Go directly to success state without tracking
    step.value = 3
  } catch (error) {
    const err = error as { response?: { data?: { message?: string } } }
    submitError.value = err.response?.data?.message || (error as Error).message || '导入书籍失败'
  } finally {
    isImporting.value = false
  }
}

function resetFlow() {
  step.value = 1
  file.value = null
  preview.value = null
  bookHash.value = ''
  submitError.value = null
  // Reset form
  form.title = ''
  form.author = ''
  form.description = ''
}

function goToTasks() {
  router.push('/admin/books')
}
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
          <Badge :variant="step >= 3 ? 'default' : 'outline'">3. 提交</Badge>
        </div>

        <!-- Error alert for submit failures -->
        <Alert v-if="submitError" variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertTitle>导入失败</AlertTitle>
          <AlertDescription>{{ submitError }}</AlertDescription>
        </Alert>

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
            <Button variant="outline" @click="resetFlow">返回</Button>
            <Button :disabled="isImporting" @click="confirmImport">
              <Loader2 v-if="isImporting" class="mr-2 size-4 animate-spin" />
              导入
            </Button>
          </div>
        </div>

        <div v-else-if="step === 3" class="space-y-4">
          <div class="rounded-md border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950">
            <CheckCircle2 class="mx-auto mb-3 size-12 text-green-600" />
            <h3 class="mb-2 text-lg font-semibold">已提交处理任务</h3>
            <p class="mb-4 text-sm text-muted-foreground">
              后台正在异步处理。你可以继续上传下一本书，或前往书籍任务页查看状态。
            </p>
            <div class="flex justify-center gap-3">
              <Button @click="resetFlow">
                继续上传书籍
              </Button>
              <Button variant="outline" @click="goToTasks">
                去往书籍任务页查看状态
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
