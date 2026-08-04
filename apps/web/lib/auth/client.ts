import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth client stub. No live sign-in in this scaffold;
 * baseURL is read from env for a later apps/api wiring task.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL
})
