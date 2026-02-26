import axios from 'axios'
import type { AxiosInstance } from 'axios'

interface User {
  id: number
  email: string
  name: string
}

interface LoginData {
  email: string
  password: string
  rememberMe?: boolean
}

interface RegisterData {
  email: string
  name: string
  password: string
}

interface AuthResponse {
  user: User
  token: string
}

interface ForgotPasswordResponse {
  message: string
}

interface ResetPasswordData {
  token: string
  password: string
  passwordConfirmation: string
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

function setTokenCookie(token: string, rememberMe?: boolean) {
  const maxAge = rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 24
  document.cookie = `auth_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`
}

function clearTokenCookie() {
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    isLoading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
  },

  actions: {
    async login(data: LoginData): Promise<AuthResponse> {
      this.isLoading = true
      try {
        const response = await api.post<AuthResponse>('/api/auth/login', data)
        const authResponse = response.data
        setTokenCookie(authResponse.token, data.rememberMe)
        this.user = authResponse.user
        return authResponse
      } finally {
        this.isLoading = false
      }
    },

    async register(data: RegisterData): Promise<AuthResponse> {
      this.isLoading = true
      try {
        const response = await api.post<AuthResponse>('/api/auth/register', data)
        const authResponse = response.data
        setTokenCookie(authResponse.token, true)
        this.user = authResponse.user
        return authResponse
      } finally {
        this.isLoading = false
      }
    },

    async logout(): Promise<void> {
      this.isLoading = true
      try {
        await api.post('/api/auth/logout')
      } finally {
        clearTokenCookie()
        this.user = null
        this.isLoading = false
      }
    },

    async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
      this.isLoading = true
      try {
        const response = await api.post<ForgotPasswordResponse>('/api/auth/forgot-password', { email })
        return response.data
      } finally {
        this.isLoading = false
      }
    },

    async resetPassword(data: ResetPasswordData): Promise<void> {
      this.isLoading = true
      try {
        await api.post('/api/auth/reset-password', data)
      } finally {
        this.isLoading = false
      }
    },
  },
})
