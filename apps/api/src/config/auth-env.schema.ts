import { z } from 'zod'

export const authEnvSchema = z.object({
  BETTER_AUTH_URL: z.string().min(1),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  DATABASE_URI: z.string().min(1)
})

export type AuthEnvConfig = z.infer<typeof authEnvSchema>

export function parseTrustedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}
