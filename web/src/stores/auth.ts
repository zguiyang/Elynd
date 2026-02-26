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

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoading = ref(false)
  const isAuthenticated = computed(() => !!user.value)

  function setTokenCookie(token: string, rememberMe?: boolean) {
    const maxAge = rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 24
    document.cookie = `auth_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`
  }

  function clearTokenCookie() {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  }

  const login = async (data: LoginData): Promise<AuthResponse> => {
    isLoading.value = true
    try {
      const response = await api.post<AuthResponse>('/api/auth/login', data)
      const authResponse = response.data
      setTokenCookie(authResponse.token, data.rememberMe)
      user.value = authResponse.user
      return authResponse
    } finally {
      isLoading.value = false
    }
  }

  const register = async (data: RegisterData): Promise<AuthResponse> => {
    isLoading.value = true
    try {
      const response = await api.post<AuthResponse>('/api/auth/register', data)
      const authResponse = response.data
      setTokenCookie(authResponse.token, true)
      user.value = authResponse.user
      return authResponse
    } finally {
      isLoading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    isLoading.value = true
    try {
      await api.post('/api/auth/logout')
    } finally {
      clearTokenCookie()
      user.value = null
      isLoading.value = false
    }
  }

  const forgotPassword = async (email: string): Promise<ForgotPasswordResponse> => {
    isLoading.value = true
    try {
      const response = await api.post<ForgotPasswordResponse>('/api/auth/forgot-password', { email })
      return response.data
    } finally {
      isLoading.value = false
    }
  }

  const resetPassword = async (data: ResetPasswordData): Promise<void> => {
    isLoading.value = true
    try {
      await api.post('/api/auth/reset-password', data)
    } finally {
      isLoading.value = false
    }
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
  }
})
