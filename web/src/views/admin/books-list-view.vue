<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { adminApi, type AdminBook, type AdminUpdateBookPayload } from '@/api/admin'
import { RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle, Upload } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { getStepText, getProgressComposition, getTaskSummary, canRetryVocabulary, canRetryAudio } from '@/composables/useBookImportStatus'
import { useBookImportSse } from '@/composables/useBookImportSse'
import { useAuthStore } from '@/stores/auth'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const router = useRouter()
const authStore = useAuthStore()

if (!authStore.user) {
  toast.error('用户信息加载失败')
  throw new Error('User not loaded')
}

// State
const page = ref(1)
const perPage = ref(20)
const list = ref<AdminBook[]>([])
const meta = ref<{
  currentPage: number
  perPage: number
  total: number
  lastPage: number
} | null>(null)
const isLoading = ref(false)
let sseRefreshTimer: ReturnType<typeof setTimeout> | null = null

// Edit dialog state
const showEditDialog = ref(false)
const editingBook = ref<AdminBook | null>(null)
const editForm = ref<AdminUpdateBookPayload>({})
const editLoading = ref(false)

// Delete dialog state
const showDeleteDialog = ref(false)
const deletingBook = ref<AdminBook | null>(null)
const deleteLoading = ref(false)

// Action confirm dialog state
type ConfirmAction = 'stop-import' | 'rebuild-chapters'
const showActionConfirmDialog = ref(false)
const confirmAction = ref<ConfirmAction | null>(null)
const confirmingBook = ref<AdminBook | null>(null)
const actionConfirmLoading = ref(false)

const {
  event: importSseEvent,
  subscribe: subscribeImportSse,
  unsubscribe: unsubscribeImportSse,
} = useBookImportSse(authStore.user.id)

// Fetch data
const fetchBooks = async (options?: { silent?: boolean }) => {
  const silent = options?.silent === true
  if (!silent) {
    isLoading.value = true
  }
  try {
    const data = await adminApi.listBooks({ page: page.value, perPage: perPage.value })
    list.value = data.data
    meta.value = data.meta
  } catch {
    toast.error('加载书籍列表失败')
  } finally {
    if (!silent) {
      isLoading.value = false
    }
  }
}

const scheduleSseRefresh = () => {
  if (sseRefreshTimer) {
    return
  }
  sseRefreshTimer = setTimeout(async () => {
    sseRefreshTimer = null
    await fetchBooks({ silent: true })
  }, 500)
}

watch(importSseEvent, (event) => {
  if (!event) {
    return
  }
  scheduleSseRefresh()
})

// Edit functions
const openEditDialog = (book: AdminBook) => {
  editingBook.value = book
  editForm.value = {
    title: book.title,
    author: book.author ?? undefined,
    description: book.description ?? undefined,
    difficultyLevel: book.difficultyLevel as 'L1' | 'L2' | 'L3',
    source: book.source,
  }
  showEditDialog.value = true
}

const handleEdit = async () => {
  if (!editingBook.value) return

  editLoading.value = true
  try {
    await adminApi.updateBook(editingBook.value.id, editForm.value)
    toast.success('更新成功')
    showEditDialog.value = false
    fetchBooks()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '更新失败')
  } finally {
    editLoading.value = false
  }
}

// Delete functions
const openDeleteDialog = (book: AdminBook) => {
  deletingBook.value = book
  showDeleteDialog.value = true
}

const handleDelete = async () => {
  if (!deletingBook.value) return

  deleteLoading.value = true
  try {
    await adminApi.deleteBook(deletingBook.value.id)
    toast.success('删除成功')
    showDeleteDialog.value = false
    fetchBooks()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '删除失败')
  } finally {
    deleteLoading.value = false
  }
}

// Vocabulary retry
const retryVocabulary = async (book: AdminBook) => {
  try {
    await adminApi.retryVocabulary(book.id)
    toast.success('词汇表重试任务已添加')
    fetchBooks()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '重试失败')
  }
}

// Audio retry
const retryAudio = async (book: AdminBook) => {
  try {
    await adminApi.retryAudio(book.id)
    toast.success('音频重试任务已添加')
    fetchBooks()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '重试失败')
  }
}

const runRebuildChapters = async (book: AdminBook) => {
  try {
    await adminApi.rebuildChapters(book.id)
    toast.success('重建任务已添加')
    fetchBooks()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '重建失败')
  }
}

const runStopImport = async (book: AdminBook) => {
  try {
    await adminApi.stopImport(book.id)
    toast.success('已停止导入流程')
    fetchBooks()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '停止失败')
  }
}

const openActionConfirmDialog = (action: ConfirmAction, book: AdminBook) => {
  confirmAction.value = action
  confirmingBook.value = book
  showActionConfirmDialog.value = true
}

const closeActionConfirmDialog = () => {
  showActionConfirmDialog.value = false
  confirmAction.value = null
  confirmingBook.value = null
}

const getActionConfirmTitle = computed(() => {
  if (confirmAction.value === 'stop-import') {
    return '确认停止导入'
  }
  if (confirmAction.value === 'rebuild-chapters') {
    return '确认重建'
  }
  return '请确认操作'
})

const getActionConfirmDescription = computed(() => {
  const title = confirmingBook.value?.title ?? '-'
  if (confirmAction.value === 'stop-import') {
    return `确定要停止《${title}》当前导入流程吗？`
  }
  if (confirmAction.value === 'rebuild-chapters') {
    return `确定要重建《${title}》的章节内容吗？该操作会重新创建重建任务。`
  }
  return '确定要继续吗？'
})

const getActionConfirmButtonText = computed(() => {
  if (confirmAction.value === 'stop-import') {
    return '停止导入'
  }
  if (confirmAction.value === 'rebuild-chapters') {
    return '确认重建'
  }
  return '确认'
})

const handleActionConfirm = async () => {
  if (!confirmAction.value || !confirmingBook.value) {
    return
  }

  actionConfirmLoading.value = true
  try {
    if (confirmAction.value === 'stop-import') {
      await runStopImport(confirmingBook.value)
    } else if (confirmAction.value === 'rebuild-chapters') {
      await runRebuildChapters(confirmingBook.value)
    }
    closeActionConfirmDialog()
  } finally {
    actionConfirmLoading.value = false
  }
}

const continueImport = async (book: AdminBook) => {
  try {
    const result = await adminApi.continueImport(book.id)
    toast.success(`已继续导入（${result.resumeStep}）`)
    fetchBooks()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || '继续导入失败')
  }
}

// Pagination
const goToPage = (newPage: number) => {
  page.value = newPage
  fetchBooks()
}

const totalPages = computed(() => meta.value ? Math.ceil(meta.value.total / meta.value.perPage) : 1)

// Status helpers
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const getStatusVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'processing':
      return 'secondary'
    case 'ready':
      return 'default'
    case 'cancelled':
      return 'outline'
    case 'failed':
      return 'destructive'
    default:
      return 'secondary'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'processing':
      return '处理中'
    case 'ready':
      return '已完成'
    case 'cancelled':
      return '已停止'
    case 'failed':
      return '失败'
    default:
      return status
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'processing':
      return Loader2
    case 'ready':
      return CheckCircle
    case 'cancelled':
      return AlertCircle
    case 'failed':
      return XCircle
    default:
      return AlertCircle
  }
}

const getStatusIconClass = (status: string) => {
  if (status === 'processing') {
    return 'h-3 w-3 mr-1 animate-spin'
  }
  return 'h-3 w-3 mr-1'
}

const isAudioPhase = (book: AdminBook) => {
  return book.audioStatus === 'processing'
}

const getDisplayProgress = (book: AdminBook) => {
  const summary = book.chapterAudioSummary

  if (book.status === 'ready') {
    return 100
  }

  // Use progress composition for canonical steps
  if (book.processingStep) {
    const composition = getProgressComposition({
      step: book.processingStep,
      stepProgress: book.processingProgress,
    })
    return composition.totalProgress
  }

  // Legacy progress calculation for audio phase
  if (summary.total > 0 && isAudioPhase(book)) {
    const audioProgress = summary.completed / summary.total
    return Math.min(99, Math.round(80 + audioProgress * 20))
  }

  return book.processingProgress
}

const getDisplayStep = (book: AdminBook) => {
  const summary = book.chapterAudioSummary

  if (summary.total > 0 && isAudioPhase(book)) {
    return `音频生成 ${summary.completed}/${summary.total}`
  }

  // Use canonical step text mapping
  if (book.processingStep) {
    return getStepText(book.processingStep)
  }

  return '-'
}

const getProgressSummary = (book: AdminBook) => {
  // Use unified task summary for dual display (audio + vocabulary)
  const taskSummary = getTaskSummary(book)

  const parts: string[] = []

  if (taskSummary.audio) {
    parts.push(`音频 ${taskSummary.audio}`)
  }

  if (taskSummary.vocabulary) {
    parts.push(`词汇 ${taskSummary.vocabulary}`)
  }

  if (parts.length === 0) {
    return null
  }

  return parts.join('，')
}

const getProgressValue = (book: AdminBook) => {
  const progress = getDisplayProgress(book)
  return Math.max(0, Math.min(100, progress))
}

// Lifecycle
onMounted(async () => {
  await fetchBooks()
  try {
    await subscribeImportSse()
  } catch {
    toast.error('状态订阅失败，可点击刷新获取最新数据')
  }
})

onUnmounted(() => {
  if (sseRefreshTimer) {
    clearTimeout(sseRefreshTimer)
    sseRefreshTimer = null
  }
  void unsubscribeImportSse()
})
</script>

<template>
  <TooltipProvider>
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">书籍任务</h1>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="router.push('/admin/books/import')">
          <Upload class="h-4 w-4 mr-2" />
          导入书籍
        </Button>
        <Button variant="outline" size="sm" @click="fetchBooks" :disabled="isLoading">
          <RefreshCw v-if="!isLoading" class="h-4 w-4 mr-2" />
          <Loader2 v-else class="h-4 w-4 mr-2 animate-spin" />
          刷新
        </Button>
      </div>
    </div>

    <!-- Table -->
    <Card>
      <CardContent class="p-0">
        <Table class="w-full table-fixed min-w-[1260px]">
          <TableHeader>
            <TableRow>
              <TableHead class="w-[190px]">书名</TableHead>
              <TableHead class="w-[110px]">作者</TableHead>
              <TableHead class="w-[90px]">状态</TableHead>
              <TableHead class="w-[180px]">进度</TableHead>
              <TableHead class="w-[140px]">步骤</TableHead>
              <TableHead class="w-[220px]">错误</TableHead>
              <TableHead class="w-[170px]">创建时间</TableHead>
              <TableHead class="sticky right-0 z-20 w-[270px] bg-background text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="isLoading && list.length === 0">
              <TableCell colspan="8" class="h-24 text-center">
                <Loader2 class="h-6 w-6 animate-spin mx-auto" />
              </TableCell>
            </TableRow>
            <TableRow v-else-if="list.length === 0">
              <TableCell colspan="8" class="h-24 text-center text-muted-foreground">
                暂无数据
              </TableCell>
            </TableRow>
            <TableRow v-for="book in list" :key="book.id">
              <TableCell class="font-medium">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <div class="w-full truncate">{{ book.title }}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ book.title }}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <div class="w-full truncate">{{ book.author || '-' }}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ book.author || '-' }}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Badge :variant="getStatusVariant(book.status)">
                  <component :is="getStatusIcon(book.status)" :class="getStatusIconClass(book.status)" />
                  {{ getStatusText(book.status) }}
                </Badge>
              </TableCell>
              <TableCell>
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-xs font-medium">
                    <span>进度</span>
                    <span>{{ getProgressValue(book) }}%</span>
                  </div>
                  <Progress :model-value="getProgressValue(book)" class="h-2" />
                  <Tooltip v-if="getProgressSummary(book)">
                    <TooltipTrigger as-child>
                      <p class="w-full truncate text-xs text-muted-foreground">
                        {{ getProgressSummary(book) }}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ getProgressSummary(book) }}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <div class="w-full truncate">{{ getDisplayStep(book) }}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ getDisplayStep(book) }}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Tooltip v-if="book.processingError">
                  <TooltipTrigger as-child>
                    <span class="block w-full truncate text-sm text-destructive">
                      {{ book.processingError }}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ book.processingError }}
                  </TooltipContent>
                </Tooltip>
                <span v-else class="text-muted-foreground">-</span>
              </TableCell>
              <TableCell>{{ new Date(book.createdAt).toLocaleString('zh-CN') }}</TableCell>
              <TableCell class="sticky right-0 z-10 bg-background shadow-[-8px_0_12px_-10px_hsl(var(--border))]">
                <div class="flex flex-wrap justify-end gap-1">
                  <!-- Rebuild chapters button -->
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-7 px-2 text-xs"
                    :disabled="book.status === 'processing'"
                    @click="openActionConfirmDialog('rebuild-chapters', book)"
                    :title="book.status === 'processing' ? '处理中请先停止导入' : '重建'"
                  >
                    重建
                  </Button>
                  <Button
                    v-if="book.status === 'processing'"
                    variant="outline"
                    size="sm"
                    class="h-7 px-2 text-xs"
                    @click="openActionConfirmDialog('stop-import', book)"
                    title="停止导入"
                  >
                    停止
                  </Button>
                  <Button
                    v-if="book.status === 'failed' || book.status === 'cancelled'"
                    variant="outline"
                    size="sm"
                    class="h-7 px-2 text-xs"
                    @click="continueImport(book)"
                    title="继续导入"
                  >
                    继续
                  </Button>
                  <!-- Audio retry button -->
                  <Button
                    v-if="canRetryAudio(book)"
                    variant="outline"
                    size="sm"
                    class="h-7 px-2 text-xs"
                    @click="retryAudio(book)"
                    title="重试音频生成"
                  >
                    重试音频
                  </Button>
                  <!-- Vocabulary retry button -->
                  <Button
                    v-if="canRetryVocabulary(book)"
                    variant="outline"
                    size="sm"
                    class="h-7 px-2 text-xs"
                    @click="retryVocabulary(book)"
                    title="重试词汇表生成"
                  >
                    重试词汇
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-7 px-2 text-xs"
                    :disabled="book.status === 'processing'"
                    @click="openEditDialog(book)"
                    :title="book.status === 'processing' ? '处理中不可操作' : '编辑'"
                  >
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-7 px-2 text-xs"
                    :disabled="book.status === 'processing'"
                    @click="openDeleteDialog(book)"
                    :title="book.status === 'processing' ? '处理中不可操作' : '删除'"
                  >
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>

      <!-- Pagination -->
      <CardFooter v-if="meta && meta.total > meta.perPage" class="flex items-center justify-between py-4">
        <div class="text-sm text-muted-foreground">
          共 {{ meta.total }} 条记录，第 {{ meta.currentPage }}/{{ totalPages }} 页
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="meta.currentPage <= 1"
            @click="goToPage(meta!.currentPage - 1)"
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="meta.currentPage >= totalPages"
            @click="goToPage(meta!.currentPage + 1)"
          >
            下一页
          </Button>
        </div>
      </CardFooter>
    </Card>

    <!-- Edit Dialog -->
    <Dialog v-model:open="showEditDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑书籍</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label>书名</Label>
            <Input v-model="editForm.title" />
          </div>
          <div class="space-y-2">
            <Label>作者</Label>
            <Input v-model="editForm.author" placeholder="可选" />
          </div>
          <div class="space-y-2">
            <Label>描述</Label>
            <Textarea v-model="editForm.description" placeholder="可选" />
          </div>
          <div class="space-y-2">
            <Label>难度</Label>
            <Select v-model="editForm.difficultyLevel">
              <SelectTrigger>
                <SelectValue placeholder="选择难度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="L1">L1 - 初级</SelectItem>
                <SelectItem value="L2">L2 - 中级</SelectItem>
                <SelectItem value="L3">L3 - 高级</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>来源</Label>
            <Select v-model="editForm.source">
              <SelectTrigger>
                <SelectValue placeholder="选择来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user_uploaded">用户上传</SelectItem>
                <SelectItem value="public_domain">公版领域</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEditDialog = false">取消</Button>
          <Button @click="handleEdit" :disabled="editLoading">
            <Loader2 v-if="editLoading" class="h-4 w-4 mr-2 animate-spin" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Dialog -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除书籍 "{{ deletingBook?.title }}" 吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="showDeleteDialog = false">取消</AlertDialogCancel>
          <AlertDialogAction as-child>
            <Button variant="destructive" @click="handleDelete" :disabled="deleteLoading">
              <Loader2 v-if="deleteLoading" class="h-4 w-4 mr-2 animate-spin" />
              删除
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Action Confirm Dialog -->
    <AlertDialog v-model:open="showActionConfirmDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ getActionConfirmTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ getActionConfirmDescription }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="closeActionConfirmDialog">取消</AlertDialogCancel>
          <AlertDialogAction as-child>
            <Button variant="destructive" @click="handleActionConfirm" :disabled="actionConfirmLoading">
              <Loader2 v-if="actionConfirmLoading" class="h-4 w-4 mr-2 animate-spin" />
              {{ getActionConfirmButtonText }}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  </TooltipProvider>
</template>
