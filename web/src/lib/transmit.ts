import { Transmit } from '@adonisjs/transmit-client'

export const transmit = new Transmit({
  baseUrl: import.meta.env.VITE_SSE_BASE_URL,
})
