import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { setupAuthGuard } from '@/router/guards/auth'
import { useAuthStore } from '@/stores/auth'

// Mock auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn()
}))

const createRoute = (
  path: string,
  meta: RouteLocationNormalized['meta'] = {}
): RouteLocationNormalized => ({
  fullPath: path,
  hash: '',
  query: {},
  name: undefined,
  path,
  params: {},
  matched: [],
  meta,
  redirectedFrom: undefined,
} as unknown as RouteLocationNormalized)

describe('auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('unauthenticated user', () => {
    it('should redirect to /auth/sign-in when accessing protected route', async () => {
      const mockStore = {
        isAuthenticated: false,
        token: null,
        user: null,
        fetchUser: vi.fn()
      }
      vi.mocked(useAuthStore).mockReturnValue(mockStore as any)

      const to = createRoute('/learning', { requiresAuth: true })
      const from = createRoute('/')

      const result = await setupAuthGuard(to, from)

      expect(result).toBe('/auth/sign-in')
    })
  })

  describe('authenticated user on auth page', () => {
    it('should redirect to /learning when accessing auth page while authenticated', async () => {
      const mockStore = {
        isAuthenticated: true,
        token: 'some-token',
        user: { id: 1, isAdmin: false },
        fetchUser: vi.fn()
      }
      vi.mocked(useAuthStore).mockReturnValue(mockStore as any)

      // 需要设置 requiresAuth: false 让guard检查auth路径
      const to = createRoute('/auth/sign-in', { requiresAuth: false })
      const from = createRoute('/')

      const result = await setupAuthGuard(to, from)

      expect(result).toBe('/learning')
    })
  })

  describe('authenticated user with token but no user', () => {
    it('should call fetchUser when token exists but user is null', async () => {
      const mockFetchUser = vi.fn().mockResolvedValue({ id: 1, isAdmin: false })
      const mockStore = {
        isAuthenticated: true,
        token: 'some-token',
        user: null,
        fetchUser: mockFetchUser
      }
      vi.mocked(useAuthStore).mockReturnValue(mockStore as any)

      const to = createRoute('/learning', { requiresAuth: true })
      const from = createRoute('/')

      const result = await setupAuthGuard(to, from)

      expect(mockFetchUser).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should redirect to /auth/sign-in when fetchUser fails', async () => {
      // 使用ref来模拟fetchUser失败后token被清除的效果
      const tokenRef = ref<string | null>('some-token')
      const mockFetchUser = vi.fn().mockImplementation(() => {
        // 模拟fetchUser失败后清除token
        tokenRef.value = null
        return Promise.resolve(null)
      })
      const mockStore = {
        get isAuthenticated() { return !!tokenRef.value },
        get token() { return tokenRef.value },
        user: null,
        fetchUser: mockFetchUser
      }
      vi.mocked(useAuthStore).mockReturnValue(mockStore as any)

      const to = createRoute('/learning', { requiresAuth: true })
      const from = createRoute('/')

      const result = await setupAuthGuard(to, from)

      expect(mockFetchUser).toHaveBeenCalled()
      expect(result).toBe('/auth/sign-in')
    })
  })

  describe('non-admin user accessing admin route', () => {
    it('should redirect to /learning when non-admin user accesses admin route', async () => {
      const mockStore = {
        isAuthenticated: true,
        token: 'some-token',
        user: { id: 1, isAdmin: false },
        fetchUser: vi.fn()
      }
      vi.mocked(useAuthStore).mockReturnValue(mockStore as any)

      const to = createRoute('/admin', { requiresAuth: true, requiresAdmin: true })
      const from = createRoute('/')

      const result = await setupAuthGuard(to, from)

      expect(result).toBe('/learning')
    })

    it('should allow admin user to access admin route', async () => {
      const mockStore = {
        isAuthenticated: true,
        token: 'some-token',
        user: { id: 1, isAdmin: true },
        fetchUser: vi.fn()
      }
      vi.mocked(useAuthStore).mockReturnValue(mockStore as any)

      const to = createRoute('/admin', { requiresAuth: true, requiresAdmin: true })
      const from = createRoute('/')

      const result = await setupAuthGuard(to, from)

      expect(result).toBe(true)
    })
  })
})
