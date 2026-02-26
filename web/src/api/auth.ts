import request from '@/lib/request'

export interface User {
  id: number
  email: string
  name: string
  avatar: string | null
}

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
  user: User
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
  login: (data: LoginData) => request.post<AuthResponse>('/api/auth/login', data),
  register: (data: RegisterData) => request.post<AuthResponse>('/api/auth/register', data),
  logout: () => request.post('/api/auth/logout'),
  forgotPassword: (email: string) => request.post<ForgotPasswordResponse>('/api/auth/forgot-password', { email }),
  resetPassword: (data: ResetPasswordData) => request.post('/api/auth/reset-password', data),
  me: () => request.get<User>('/api/user/me'),
}
