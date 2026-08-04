import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'

import { getAuthToken } from './token'

/**
 * Better Auth client for apps/api (`/api/auth/*`).
 * Session credential: Bearer token from localStorage (not cookie-primary).
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  plugins: [usernameClient()],
  fetchOptions: {
    onRequest(context) {
      const token = getAuthToken()
      if (token) {
        context.headers.set('Authorization', `Bearer ${token}`)
      }
    }
  }
})
