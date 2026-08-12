export { AUTH_ADMIN_ROLE } from '@elynd/shared/auth/policy';

export const APP_NAME = 'Elynd' as const;

export const AUTH_ROUTES = {
  signIn: '/sign-in',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  dashboard: '/dashboard',
  library: '/library',
  libraryArticle: (id: string) => `/library/${id}` as const,
  learn: '/learn',
  learnArticle: (id: string) => `/learn/${id}` as const,
  learnPractice: (id: string) => `/learn/${id}/practice` as const,
} as const;

/** Static demo ids for Today → Learn wiring (no API yet). */
export const LEARN_DEMO = {
  oceans: 'demo-oceans',
  habits: 'demo-habits',
} as const;

export const ADMIN_ROUTES = {
  root: '/admin',
  articles: '/admin/articles',
  articleNew: '/admin/articles/new',
  articleEdit: (id: string) => `/admin/articles/${id}/edit` as const,
} as const;
