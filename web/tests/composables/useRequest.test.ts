import { describe, expect, it, vi } from 'vitest'
import { useRequest } from '@/composables/useRequest'

describe('useRequest', () => {
  it('updates loading state and stores fetched data on success', async () => {
    let resolveFetcher!: (value: { id: number }) => void
    let hasResolver = false
    const fetcher = vi.fn(
      () =>
        new Promise<{ id: number }>((resolve) => {
          resolveFetcher = resolve
          hasResolver = true
        })
    )

    const request = useRequest({ fetcher })
    const pendingResult = request.execute()

    expect(request.isLoading.value).toBe(true)
    expect(request.error.value).toBe(null)
    expect(request.data.value).toBe(null)

    if (!hasResolver) {
      throw new Error('Expected fetcher resolver to be assigned')
    }

    resolveFetcher({ id: 1 })
    const result = await pendingResult

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ id: 1 })
    expect(request.data.value).toEqual({ id: 1 })
    expect(request.error.value).toBe(null)
    expect(request.isLoading.value).toBe(false)
  })

  it('captures the error and resets loading state on failure', async () => {
    const error = new Error('request failed')
    const fetcher = vi.fn(async () => {
      throw error
    })

    const request = useRequest({ fetcher })
    const result = await request.execute()

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result).toBe(null)
    expect(request.data.value).toBe(null)
    expect(request.error.value).toBe(error)
    expect(request.isLoading.value).toBe(false)
  })
})
