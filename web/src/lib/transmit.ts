import { Transmit } from '@adonisjs/transmit-client'

const resolveSseBaseUrl = (): string => {
  const rawValue = import.meta.env.VITE_SSE_BASE_URL ?? ''
  if (!rawValue) {
    return window.location.origin
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawValue) || rawValue.startsWith('//')
  if (hasScheme) {
    return rawValue
  }

  if (rawValue.startsWith('/')) {
    return `${window.location.origin}${rawValue}`
  }

  return `${window.location.origin}/${rawValue}`
}

export const transmit = new Transmit({
  baseUrl: resolveSseBaseUrl(),
})
