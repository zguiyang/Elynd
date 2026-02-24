import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, AuthResponse } from '~/api/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const { $api } = useNuxtApp()

  const tokenCookie = useCookie('auth_token', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production'
  })

  const isAuthenticated = computed(() => !!tokenCookie.value)
  const isEmailVerified = computed(() => user.value?.isEmailVerified === true)

  const fetchUser = async () => {
    const data = await $api<User>('/user/me')
    if (data) {
      user.value = data
    }
    return user.value
  }

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    const data = await $api<AuthResponse>('/auth/login', {
      method: 'post',
      body: { email, password, rememberMe }
    })
    if (data) {
      user.value = data.user
      tokenCookie.value = data.token
    }
    return data
  }

  const register = async (email: string, password: string, fullName: string) => {
    const data = await $api<AuthResponse>('/auth/register', {
      method: 'post',
      body: { email, password, name: fullName }
    })
    if (data) {
      user.value = data.user
      tokenCookie.value = data.token
    }
    return data
  }

  const logout = async () => {
    await $api('/auth/logout', { method: 'post' })
    user.value = null
    tokenCookie.value = null
  }

  const setUser = (userData: User | null) => {
    user.value = userData
  }

  const setToken = (newToken: string | null) => {
    tokenCookie.value = newToken
  }

  return {
    user,
    isAuthenticated,
    isEmailVerified,
    fetchUser,
    login,
    register,
    logout,
    setUser,
    setToken
  }
}, {
  persist: false
})
