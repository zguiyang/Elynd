export const APP_NAME = 'Elynd' as const;

/** Matches backend `AUTH_ADMIN_ROLE` — used for UI nav only. */
export const AUTH_ADMIN_ROLE = 'admin' as const;

export const AUTH_ROUTES = {
  signIn: '/sign-in',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  dashboard: '/dashboard',
} as const;

export const ADMIN_ROUTES = {
  root: '/admin',
  articles: '/admin/articles',
  articleNew: '/admin/articles/new',
  articleEdit: (id: string) => `/admin/articles/${id}/edit` as const,
} as const;

export const ADMIN_ARTICLES_PAGE_SIZE = 10 as const;
