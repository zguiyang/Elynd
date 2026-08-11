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
} as const;

export const ADMIN_ROUTES = {
  root: '/admin',
  articles: '/admin/articles',
  articleNew: '/admin/articles/new',
  articleEdit: (id: string) => `/admin/articles/${id}/edit` as const,
} as const;

export const ADMIN_ARTICLES_PAGE_SIZE = 10 as const;
