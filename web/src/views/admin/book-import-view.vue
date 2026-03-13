<script setup lang="ts">
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { adminApi } from '@/api/admin'
import { useBookImportStatus, getStepText } from '@/composables/useBookImportStatus'

const isImporting = ref(false)
const selectedFile = ref<File | null>(null)
const bookHash = ref('')
const submitError = ref<string | null>(null)
const source = ref<'user_uploaded' | 'public_domain' | 'ai_generated'>('user_uploaded')

const importStatus = useBookImportStatus()
const currentStatus = computed(() => unref(importStatus.status))

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
    await importStatus.startTracking(result.bookId)
    toast.success('导入任务已创建，正在后台处理')
  } catch (error) {
    const err = error as { response?: { data?: { message?: string } } }
    submitError.value = err.response?.data?.message || (error as Error).message || '导入失败'
  } finally {
    isImporting.value = false
  }
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  selectedFile.value = target.files?.[0] || null
}
</script>

<template>
  <div class="container mx-auto max-w-4xl px-4 py-8">
    <Card>
      <CardHeader>
        <CardTitle>导入书籍</CardTitle>
      </CardHeader>
      <CardContent class="space-y-6">
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
              <SelectItem value="ai_generated">ai_generated</SelectItem>
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

        <div v-if="currentStatus" class="rounded-md border p-4">
          <div class="mb-2 flex items-center gap-2 text-sm">
            <Loader2
              v-if="currentStatus.status === 'processing'"
              class="size-4 animate-spin text-muted-foreground"
            />
            <CheckCircle2
              v-else-if="currentStatus.status === 'ready'"
              class="size-4 text-green-600"
            />
            <AlertCircle v-else class="size-4 text-red-600" />
            <span>{{ getStepText(currentStatus.processingStep || '') }}</span>
          </div>
          <Progress :model-value="currentStatus.processingProgress" />
          <p class="mt-2 text-xs text-muted-foreground">
            {{ currentStatus.processingProgress }}%
          </p>
          <p v-if="currentStatus.processingError" class="mt-2 text-sm text-red-600">
            {{ currentStatus.processingError }}
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
