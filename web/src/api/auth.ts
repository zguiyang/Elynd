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
}

export interface ForgotPasswordResponse {
  message: string
}

export interface ResetPasswordData {
  token: string
  password: string
  passwordConfirmation: string
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
}
