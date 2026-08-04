export const APP_NAME = 'Elynd' as const;

/** localStorage key for Better Auth Bearer session token */
export const AUTH_TOKEN_STORAGE_KEY = 'elynd.auth.token' as const;

export const AUTH_ROUTES = {
  signIn: '/sign-in',
  signUp: '/sign-up',
  dashboard: '/dashboard',
} as const;
