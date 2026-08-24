export { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

export const APP_NAME = '书灯阅读' as const;

export const AUTH_ROUTES = {
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  shelf: '/my-shelf',
  /** Discover catalog. */
  discover: '/discover',
  /** Discover book detail (mock UI; future catalog item). */
  bookDetail: (id: string) => `/discover/${id}` as const,
  history: '/reading-history',
  /** Immersive reader (mock UI; future book/chapter API). */
  read: '/read',
  readBook: (id: string) => `/read/${id}` as const,
} as const;

export const ADMIN_ROUTES = {
  root: '/admin',
  articles: '/admin/articles',
  articleNew: '/admin/articles/new',
  articleEdit: (id: string) => `/admin/articles/${id}/edit` as const,
  articleAudio: (id: string) => `/admin/articles/${id}/audio` as const,
  ai: '/admin/ai',
  aiLogs: '/admin/ai-logs',
  tts: '/admin/tts',
  ttsLogs: '/admin/tts-logs',
} as const;
