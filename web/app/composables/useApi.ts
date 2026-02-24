/**
 * Nuxt Composables - API Data Fetching
 *
 * Provides useApi<T>() - Nuxt-native data fetching with:
 * - Full SSR compatibility
 * - Type safety via generics
 * - Access to pending, error, status, refresh states
 *
 * Usage:
 * const { data, pending, error, refresh } = await useApi<T>('/api/endpoint', {
 *   method: 'get',
 *   query: { page: 1 },
 *   body: { ... }
 * })
 */

import type { UseFetchOptions } from 'nuxt/app'

interface UseApiOptions extends UseFetchOptions<unknown> {
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
  query?: Record<string, any>
}

export function useApi<T>(
  url: string | (() => string),
  options?: UseApiOptions
) {
  const nuxtApp = useNuxtApp()

  const { method, query, body, ...restOptions } = options || {}

  return useFetch(url, {
    method: method || 'get',
    query,
    body,
    $fetch: nuxtApp.$api,
    ...restOptions
  } as UseFetchOptions<T>)
}
