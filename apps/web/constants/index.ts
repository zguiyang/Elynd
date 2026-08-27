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
  works: '/admin/works',
  workNew: '/admin/works/new',
  workDetail: (id: string) => `/admin/works/${id}` as const,
  workPreview: (id: string) => `/admin/works/${id}/preview` as const,
  workPreviewPart: (id: string, partId: string) => `/admin/works/${id}/preview/part/${partId}` as const,
  workEdit: (id: string) => `/admin/works/${id}/edit` as const,
  ai: '/admin/ai',
  aiLogs: '/admin/ai-logs',
  tts: '/admin/tts',
  ttsLogs: '/admin/tts-logs',
  taxonomy: '/admin/taxonomy',
} as const;
