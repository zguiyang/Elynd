import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export async function setupAuthGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore()
  // 检查 cookie 中是否有 token
  const hasToken = document.cookie.split('; ').some(row => row.startsWith('auth_token='))

  if (!authStore.user && hasToken) {
    await authStore.fetchUser()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/auth/sign-in')
  } else if (to.meta.guest && authStore.isAuthenticated) {
    next('/learning')
  } else {
    next()
  }
}
