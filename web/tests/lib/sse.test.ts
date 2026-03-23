import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSseBaseUrl } from '@/lib/sse-base-url'

describe('sse base url resolver', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to current origin when env is empty', () => {
    vi.stubEnv('VITE_SSE_BASE_URL', '')

    expect(resolveSseBaseUrl()).toBe(window.location.origin)
  })

  it('resolves relative path without leading slash', () => {
    vi.stubEnv('VITE_SSE_BASE_URL', 'backend')

    expect(resolveSseBaseUrl()).toBe(`${window.location.origin}/backend`)
  })

  it('resolves relative path with leading slash', () => {
    vi.stubEnv('VITE_SSE_BASE_URL', '/backend')

    expect(resolveSseBaseUrl()).toBe(`${window.location.origin}/backend`)
  })

  it('keeps absolute url unchanged', () => {
    vi.stubEnv('VITE_SSE_BASE_URL', 'https://api.example.com')

    expect(resolveSseBaseUrl()).toBe('https://api.example.com')
  })
})
