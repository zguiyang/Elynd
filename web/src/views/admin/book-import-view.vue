<script setup lang="ts">
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { adminApi } from '@/api/admin'
import { useBookImportStatus } from '@/composables/useBookImportStatus'

const isImporting = ref(false)
const selectedFile = ref<File | null>(null)
const bookHash = ref('')
const submitError = ref<string | null>(null)
const source = ref<'user_uploaded' | 'public_domain'>('user_uploaded')
const importedBookId = ref<number | null>(null)

const router = useRouter()
const importStatus = useBookImportStatus()

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function importNow() {
  if (!selectedFile.value) {
    toast.error('请选择要导入的文件')
    return
  }

  isImporting.value = true
  submitError.value = null

  try {
    bookHash.value = await computeFileHash(selectedFile.value)
    const result = await adminApi.importBook({
      file: selectedFile.value,
      source: source.value,
      bookHash: bookHash.value
    })
    importedBookId.value = result.bookId
    await importStatus.startTracking(result.bookId)
    toast.success('导入成功')
  } catch (error) {
    const err = error as { message?: string }
    submitError.value = err.message || '导入失败'
  } finally {
    isImporting.value = false
  }
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  selectedFile.value = target.files?.[0] || null
}

function resetImportForm() {
  selectedFile.value = null
  bookHash.value = ''
  submitError.value = null
  importedBookId.value = null
}

function goToBooksList() {
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
        <div v-if="importedBookId" class="space-y-4 rounded-lg border bg-muted/20 p-6">
          <div class="flex items-center gap-2 text-primary">
            <CheckCircle2 class="size-5" />
            <p class="font-medium">导入成功，任务已进入后台处理</p>
          </div>
          <p class="text-sm text-muted-foreground">
            你可以继续导入下一本书，或前往书籍列表查看处理进度。
          </p>
          <div class="flex gap-3">
            <Button variant="outline" @click="resetImportForm">继续导入书籍</Button>
            <Button @click="goToBooksList">查看进度</Button>
          </div>
        </div>

        <template v-else>
          <Alert v-if="submitError" variant="destructive">
            <AlertCircle class="h-4 w-4" />
            <AlertTitle>导入失败</AlertTitle>
            <AlertDescription>{{ submitError }}</AlertDescription>
          </Alert>

          <label
            class="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center"
          >
            <Upload class="mb-3 size-8 text-muted-foreground" />
            <p class="font-medium">拖拽文件到此处或点击上传</p>
            <p class="mt-1 text-sm text-muted-foreground">仅支持 .epub 和 .txt，最大 4MB</p>
            <input class="hidden" type="file" accept=".epub,.txt" @change="onFileChange" />
          </label>

          <div class="space-y-2">
            <Label>来源</Label>
            <Select v-model="source">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user_uploaded">user_uploaded</SelectItem>
                <SelectItem value="public_domain">public_domain</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex gap-3">
            <Button :disabled="!selectedFile || isImporting" @click="importNow">
              <Loader2 v-if="isImporting" class="mr-2 size-4 animate-spin" />
              开始导入
            </Button>
            <span v-if="selectedFile" class="self-center text-sm text-muted-foreground">
              {{ selectedFile.name }}
            </span>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
