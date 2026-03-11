<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { toast } from 'vue-sonner'
import { adminApi, type AdminBook, type AdminUpdateBookPayload } from '@/api/admin'
import { RefreshCw, Loader2, Pencil, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Upload } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const router = useRouter()

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
const isPolling = ref(false)
let pollInterval: ReturnType<typeof setInterval> | null = null

// Edit dialog state
const showEditDialog = ref(false)
const editingBook = ref<AdminBook | null>(null)
const editForm = ref<AdminUpdateBookPayload>({})
const editLoading = ref(false)

// Delete dialog state
const showDeleteDialog = ref(false)
const deletingBook = ref<AdminBook | null>(null)
const deleteLoading = ref(false)

// Fetch data
const fetchBooks = async () => {
  isLoading.value = true
  try {
    const data = await adminApi.listBooks({ page: page.value, perPage: perPage.value })
    list.value = data.data
    meta.value = data.meta
  } catch {
    toast.error('加载书籍列表失败')
  } finally {
    isLoading.value = false
  }
}

// Polling
const startPolling = () => {
  if (pollInterval) return
  isPolling.value = true
  pollInterval = setInterval(() => {
    if (!document.hidden) {
      fetchBooks()
    }
  }, 5000)
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  isPolling.value = false
}

// Visibility handling
const handleVisibilityChange = () => {
  if (document.hidden) {
    stopPolling()
  } else {
    fetchBooks()
    startPolling()
  }
}

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
    case 'failed':
      return '失败'
    default:
      return status
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'processing':
      return Clock
    case 'ready':
      return CheckCircle
    case 'failed':
      return XCircle
    default:
      return AlertCircle
  }
}

// Lifecycle
onMounted(() => {
  fetchBooks()
  startPolling()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>书名</TableHead>
              <TableHead>作者</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>进度</TableHead>
              <TableHead>步骤</TableHead>
              <TableHead>错误</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>操作</TableHead>
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
              <TableCell class="font-medium">{{ book.title }}</TableCell>
              <TableCell>{{ book.author || '-' }}</TableCell>
              <TableCell>
                <Badge :variant="getStatusVariant(book.status)">
                  <component :is="getStatusIcon(book.status)" class="h-3 w-3 mr-1" />
                  {{ getStatusText(book.status) }}
                </Badge>
              </TableCell>
              <TableCell>{{ book.processingProgress }}%</TableCell>
              <TableCell>{{ book.processingStep || '-' }}</TableCell>
              <TableCell>
                <span v-if="book.processingError" class="text-destructive text-sm line-clamp-1" :title="book.processingError">
                  {{ book.processingError }}
                </span>
                <span v-else class="text-muted-foreground">-</span>
              </TableCell>
              <TableCell>{{ new Date(book.createdAt).toLocaleString('zh-CN') }}</TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    :disabled="book.status === 'processing'"
                    @click="openEditDialog(book)"
                    :title="book.status === 'processing' ? '处理中不可操作' : '编辑'"
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    :disabled="book.status === 'processing'"
                    @click="openDeleteDialog(book)"
                    :title="book.status === 'processing' ? '处理中不可操作' : '删除'"
                  >
                    <Trash2 class="h-4 w-4" />
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
                <SelectItem value="ai_generated">AI 生成</SelectItem>
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
          <AlertDialogAction @click="handleDelete" :disabled="deleteLoading" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            <Loader2 v-if="deleteLoading" class="h-4 w-4 mr-2 animate-spin" />
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
