import { z } from 'zod'

export const authEnvSchema = z.object({
  BETTER_AUTH_CLIENT_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  DATABASE_URI: z.string().min(1)
})

export type AuthEnvConfig = z.infer<typeof authEnvSchema>
