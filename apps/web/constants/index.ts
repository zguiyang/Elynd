export { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

export const APP_NAME = '书灯阅读' as const;

export const AUTH_ROUTES = {
  signIn: '/sign-in',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  shelf: '/my-shelf',
  library: '/library',
  /** Discover book detail (mock UI; future catalog item). */
  bookDetail: (id: string) => `/library/${id}` as const,
  /** Reading history (formerly /progress · 成长). */
  history: '/reading-history',
  learn: '/learn',
  learnArticle: (id: string) => `/learn/${id}` as const,
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
