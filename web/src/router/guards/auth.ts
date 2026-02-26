import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export async function setupAuthGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore()

  // 默认需要登录，除非明确设置为 requiresAuth: false
  const requiresAuth = to.meta.requiresAuth !== false

  // 如果访问的是需要登录的页面
  if (requiresAuth) {
    if (!authStore.isAuthenticated) {
      return next('/auth/sign-in')
    }
    
    // 已登录但没有用户信息时尝试拉取
    if (!authStore.user && authStore.token) {
      await authStore.fetchUser()
      // 如果 fetchUser 失败（比如 token 过期被清理了），重新检查认证状态
      if (!authStore.isAuthenticated) {
        return next('/auth/sign-in')
      }
    }
  } else if (to.path.startsWith('/auth') && authStore.isAuthenticated) {
    // 如果访问的是 auth 相关页面（如登录/注册），且已登录，则跳转到学习页
    return next('/learning')
  }

  next()
}
