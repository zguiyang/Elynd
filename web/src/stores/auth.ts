import { authApi      } from '@/api/auth'
import type {LoginData, RegisterData, AuthResponse, ForgotPasswordResponse, ResetPasswordData} from '@/api/auth';
import { userApi } from '@/api/user';
import type { User } from '@/api/user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isLoading = ref(false)
  const isAuthenticated = computed(() => !!token.value)

  const login = async (data: LoginData): Promise<AuthResponse | null> => {
    isLoading.value = true
    const authResponse = await authApi.login(data)
      .then((res) => res as unknown as AuthResponse)
      .catch(() => null)
    isLoading.value = false
    
    if (authResponse) {
      token.value = authResponse.token
      user.value = authResponse.user as unknown as User
      return authResponse
    }
    return null
  }

  const register = async (data: RegisterData): Promise<AuthResponse | null> => {
    isLoading.value = true
    const authResponse = await authApi.register(data)
      .then((res) => res as unknown as AuthResponse)
      .catch(() => null)
    isLoading.value = false
    
    if (authResponse) {
      token.value = authResponse.token
      user.value = authResponse.user as unknown as User
      return authResponse
    }
    return null
  }

  const logout = async (): Promise<void> => {
    isLoading.value = true
    await authApi.logout().catch(() => null)
    token.value = null
    user.value = null
    isLoading.value = false
    if (typeof localStorage.removeItem === 'function') {
      localStorage.removeItem('__Elynd__auth')
      localStorage.removeItem('book-import-tracking-id')
    } else if (typeof localStorage.clear === 'function') {
      localStorage.clear()
    }
    window.location.href = '/auth/sign-in'
  }

  const forgotPassword = async (email: string): Promise<ForgotPasswordResponse | null> => {
    isLoading.value = true
    const response = await authApi.forgotPassword(email)
      .then((res) => res as unknown as ForgotPasswordResponse)
      .catch(() => null)
    isLoading.value = false
    return response ?? null
  }

  const resetPassword = async (data: ResetPasswordData): Promise<boolean> => {
    isLoading.value = true
    const response = await authApi.resetPassword(data)
      .then(() => true)
      .catch(() => false)
    isLoading.value = false
    return response
  }

  const fetchUser = async () => {
     const userResponse = await userApi.me().catch(() => {
       token.value = null;
       user.value = null;
       return null;
     });
     if (userResponse) {
       user.value = userResponse as unknown as User;
       return userResponse;
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
