import { Transmit } from '@adonisjs/transmit-client'
import { resolveSseBaseUrl } from '@/lib/sse-base-url'

export const transmit = new Transmit({
  baseUrl: resolveSseBaseUrl(),
})
