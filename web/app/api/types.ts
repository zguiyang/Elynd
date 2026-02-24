export interface User {
  id: number
  fullName: string | null
  email: string
  isEmailVerified: boolean
  avatar: string | null
  resetPasswordToken: string | null
  resetPasswordExpiresAt: string | null
  createdAt: string
  updatedAt: string | null
}

export interface AuthResponse {
  user: User
  token: string
}

export interface LoginRequest {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  email: string
  name: string
  password: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
  passwordConfirmation: string
}

export interface ChangeEmailRequest {
  newEmail: string
  password: string
}

export interface ChangeEmailResponse {
  message: string
  user: User
}

export interface Tag {
  id: number
  name: string
  color: string | null
  userId: number
  isAiGenerated: boolean // 新增
  bookmarksCount: number
  memosCount: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateTagRequest {
  name: string
  color?: string
}

export interface UpdateTagRequest {
  name?: string
  color?: string
}

export type BookmarkStatus = 'fetching' | 'active' | 'archived'

export interface BookmarkMetadata {
  ogTitle?: string | null
  ogDescription?: string | null
  ogImage?: {
    url?: string | null
    width?: number | null
    height?: number | null
    type?: string | null
  } | null
  favicon?: string | null
  requestUrl: string
  success: boolean
  error?: string | null
  fetchError?: string | null
  fetchedAt: string | null
}

export interface Bookmark {
  id: number
  title: string
  url: string
  description: string | null
  visitCount: number
  userId: number
  tags: Tag[]
  status: BookmarkStatus
  metadata?: BookmarkMetadata
  createdAt: string
  updatedAt: string | null
}

export interface BookmarkPaginationParams {
  page?: number
  perPage?: number
  search?: string
  tagIds?: number[]
  sortBy?: 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface MemoPaginationParams {
  page?: number
  perPage?: number
  search?: string
  tagIds?: number[]
  sortBy?: 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface CreateBookmarkRequest {
  url: string
  title?: string | null
  description?: string | null
  tagIds?: number[]
  autoFetch?: boolean
  autoAiTag?: boolean // 新增
}

export interface CreateBookmarkByUrlRequest {
  url: string
  tagIds?: number[]
  autoFetch?: boolean
  autoAiTag?: boolean // 新增
}

export interface UpdateBookmarkRequest {
  title?: string
  url?: string
  description?: string
  tagIds?: number[]
}

export interface PaginatorMeta {
  currentPage: number
  perPage: number
  total: number
  lastPage: number
}

export interface Memo {
  id: number
  title: string
  content: string
  isPinned: boolean
  userId: number
  tags: Tag[]
  createdAt: string
  updatedAt: string | null
}

export interface CreateMemoRequest {
  title: string
  content: string
  isPinned?: boolean
  tagIds?: number[]
}

export interface UpdateMemoRequest {
  title?: string
  content?: string
  isPinned?: boolean
  tagIds?: number[]
}

export interface PaginatedResponse<T> {
  meta: PaginatorMeta
  data: T[]
}

export interface ImportResultData {
  total: number
  imported: number
  skipped: number
  errors: number
  tagsCreated: number
  errorsList: Array<{
    title: string
    url: string
    reason: string
  }>
}

export interface AsyncImportResponseData {
  jobId: string
  status: 'waiting'
  current: number
}

export interface UserSettings {
  aiBaseUrl: string | null
  aiModelName: string | null
  aiEnabled: boolean
}

export interface UpdateSettingsRequest {
  aiBaseUrl?: string | null
  aiApiKey?: string
  aiModelName?: string | null
  aiEnabled?: boolean
}

export type PaginationData<T> = PaginatedResponse<T>

export interface TagItem {
  type: 'bookmark' | 'memo'
  id: number
  title: string
  url?: string | null
  content?: string | null
  createdAt: string
  tags: Tag[]
}

export interface TagItemsResponse {
  data: TagItem[]
  meta: {
    total: number
    page: number
    perPage: number
    lastPage: number
  }
}

export interface TagItemsParams {
  type: 'bookmark' | 'memo'
  page?: number
  perPage?: number
  sortOrder?: 'asc' | 'desc'
}

export interface ImportProgressData {
  jobId: string
  current: number
  total: number
  currentTitle: string
}
