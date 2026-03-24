import { request } from '@/lib/request'

export interface LoginData {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  email: string
  name: string
  password: string
}

export interface AuthResponse {
  user: {
    id: number
    email: string
    fullName: string | null
    avatar: string | null
  }
  token: string
  isNew?: boolean
}

export interface ForgotPasswordResponse {
  message: string
}

export interface ResetPasswordData {
  token: string
  password: string
  passwordConfirmation: string
}

export interface OAuthUrlResponse {
  url: string
}

export interface OAuthCallbackData {
  provider: string
  code: string
  rememberMe?: boolean
}

export const authApi = {
  login: (data: LoginData) =>
    request<AuthResponse>({ method: 'POST', url: '/api/auth/login', data }),

  register: (data: RegisterData) =>
    request<AuthResponse>({ method: 'POST', url: '/api/auth/register', data }),

  logout: () =>
    request<void>({ method: 'POST', url: '/api/auth/logout' }),

  forgotPassword: (email: string) =>
    request<ForgotPasswordResponse>({ method: 'POST', url: '/api/auth/forgot-password', data: { email } }),

  resetPassword: (data: ResetPasswordData) =>
    request<void>({ method: 'POST', url: '/api/auth/reset-password', data }),

  // Generic OAuth
  getOAuthUrl: (provider: string) =>
    request<OAuthUrlResponse>({ method: 'GET', url: `/api/auth/${provider}/url` }),

  oauthCallback: (data: OAuthCallbackData) =>
    request<AuthResponse>({ method: 'POST', url: `/api/auth/${data.provider}/callback`, data }),

  // GitHub OAuth (deprecated - use getOAuthUrl and oauthCallback instead)
  getGithubUrl: () =>
    request<OAuthUrlResponse>({ method: 'GET', url: '/api/auth/github/url' }),

  githubCallback: (data: Omit<OAuthCallbackData, 'provider'>) =>
    request<AuthResponse>({ method: 'POST', url: '/api/auth/github/callback', data }),
}
