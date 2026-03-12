import { afterEach } from 'vitest'

// Global test setup - restore mocks after each test
afterEach(() => {
  vi.restoreAllMocks()
})
