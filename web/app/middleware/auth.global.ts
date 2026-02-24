import { useAuthStore } from '@/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  const publicRoutes = ['/', '/auth/sign-in', '/auth/sign-up', '/auth/forgot-password', '/auth/reset-password', '/verify-email']

  const token = useCookie('auth_token')

  if (publicRoutes.includes(to.path)) {
    return
  }

  if (!token.value) {
    const redirectUrl = encodeURIComponent(to.path)
    return navigateTo(`/auth/sign-in?redirect=${redirectUrl}`)
  }

  const authStore = useAuthStore()

  if (!authStore.user) {
    try {
      await authStore.fetchUser()
    } catch {
      token.value = null
      authStore.setUser(null)
      const redirectUrl = encodeURIComponent(to.path)
      return navigateTo(`/auth/sign-in?redirect=${redirectUrl}`)
    }
  }
})
