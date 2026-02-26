import { authApi } from '@/api/auth'
import { userApi, type User } from '@/api/user'
import type { LoginData, RegisterData, AuthResponse, ForgotPasswordResponse, ResetPasswordData } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isLoading = ref(false)
  const isAuthenticated = computed(() => !!token.value)

  const login = async (data: LoginData): Promise<AuthResponse> => {
    isLoading.value = true
    try {
      const response = await authApi.login(data)
      const authResponse = response.data
      token.value = authResponse.token
      user.value = authResponse.user as unknown as User
      return authResponse
    } finally {
      isLoading.value = false
    }
  }

  const register = async (data: RegisterData): Promise<AuthResponse> => {
    isLoading.value = true
    try {
      const response = await authApi.register(data)
      const authResponse = response.data
      token.value = authResponse.token
      user.value = authResponse.user as unknown as User
      return authResponse
    } finally {
      isLoading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    isLoading.value = true
    try {
      await authApi.logout()
    } finally {
      token.value = null
      user.value = null
      isLoading.value = false
      localStorage.clear()
      window.location.href = '/auth/sign-in'
    }
  }

  const forgotPassword = async (email: string): Promise<ForgotPasswordResponse> => {
    isLoading.value = true
    try {
      const response = await authApi.forgotPassword(email)
      return response.data
    } finally {
      isLoading.value = false
    }
  }

  const resetPassword = async (data: ResetPasswordData): Promise<void> => {
    isLoading.value = true
    try {
      await authApi.resetPassword(data)
    } finally {
      isLoading.value = false
    }
  }

  const fetchUser = async (): Promise<User | null> => {
    try {
      const response = await userApi.me()
      user.value = response.data
      return user.value
    } catch {
      token.value = null
      user.value = null
      return null
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    fetchUser,
  }
}, {
  persist: {
    pick: ['token'],
  },
})
