import { authApi } from '@/api/auth'
import type { User, LoginData, RegisterData, AuthResponse, ForgotPasswordResponse, ResetPasswordData } from '@/api/auth'

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
      const response = await authApi.login(data)
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
      const response = await authApi.register(data)
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
      await authApi.logout()
    } finally {
      clearTokenCookie()
      user.value = null
      isLoading.value = false
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
      const response = await authApi.me()
      user.value = response.data
      return user.value
    } catch {
      clearTokenCookie()
      user.value = null
      return null
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
    fetchUser,
  }
}, {
  persist: true,
})
