import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/api/user'

// Mock API modules
vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn()
  }
}))

vi.mock('@/api/user', () => ({
  userApi: {
    me: vi.fn()
  }
}))

// Stub browser APIs
const localStorageMock = {
  clear: vi.fn(),
  removeItem: vi.fn(),
}

vi.stubGlobal('localStorage', localStorageMock)

vi.stubGlobal('window', {
  location: {
    href: ''
  }
})

import { authApi } from '@/api/auth'
import { userApi } from '@/api/user'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.location.href = ''
    localStorageMock.clear.mockClear()
    localStorageMock.removeItem.mockClear()
  })

  describe('login', () => {
    it('should store token and user on successful login', async () => {
      const mockResponse = {
        token: 'test-token-123',
        user: {
          id: 1,
          fullName: 'Test User',
          email: 'test@example.com',
          avatar: null,
          isAdmin: false,
          createdAt: '2024-01-01T00:00:00.000Z',
        } satisfies User
      }
      vi.mocked(authApi.login).mockResolvedValue(mockResponse as any)

      const authStore = useAuthStore()
      const result = await authStore.login({ email: 'test@example.com', password: 'password123' })

      expect(result).toEqual(mockResponse)
      expect(authStore.token).toBe('test-token-123')
      expect(authStore.user).toEqual(mockResponse.user)
      expect(authStore.isAuthenticated).toBe(true)
    })

    it('should return null and preserve empty state on login failure', async () => {
      vi.mocked(authApi.login).mockRejectedValue(new Error('Invalid credentials'))

      const authStore = useAuthStore()
      const result = await authStore.login({ email: 'wrong@example.com', password: 'wrongpass' })

      expect(result).toBeNull()
      expect(authStore.token).toBeNull()
      expect(authStore.user).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
    })
  })

  describe('fetchUser', () => {
    it('should clear token and user on fetchUser failure', async () => {
      const authStore = useAuthStore()
      // 先设置登录状态
      authStore.token = 'expired-token'
      authStore.user = {
        id: 1,
        fullName: 'Old User',
        email: 'old@example.com',
        avatar: null,
        isAdmin: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      vi.mocked(userApi.me).mockRejectedValue(new Error('Token expired'))

      await authStore.fetchUser()

      expect(authStore.token).toBeNull()
      expect(authStore.user).toBeNull()
    })

    it('should update user on fetchUser success', async () => {
      const authStore = useAuthStore()
      authStore.token = 'valid-token'

      const mockUser: User = {
        id: 1,
        fullName: 'Updated User',
        email: 'updated@example.com',
        avatar: null,
        isAdmin: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      }
      vi.mocked(userApi.me).mockResolvedValue(mockUser)

      await authStore.fetchUser()

      expect(authStore.user).toEqual(mockUser)
    })
  })

  describe('logout', () => {
    it('should clear state and redirect to /auth/sign-in', async () => {
      const authStore = useAuthStore()
      authStore.token = 'some-token'
      authStore.user = {
        id: 1,
        fullName: 'Test User',
        email: 'test@example.com',
        avatar: null,
        isAdmin: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      }

      vi.mocked(authApi.logout).mockResolvedValue(undefined)

      await authStore.logout()

      expect(authStore.token).toBeNull()
      expect(authStore.user).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('__Elynd__auth')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('book-import-tracking-id')
      expect(localStorageMock.clear).not.toHaveBeenCalled()
      expect(window.location.href).toBe('/auth/sign-in')
    })
  })
})
