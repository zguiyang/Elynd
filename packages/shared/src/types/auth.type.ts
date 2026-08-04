export type SessionUser = {
  id: string
  email: string
  name: string
  image?: string | null
  emailVerified?: boolean
  createdAt?: Date | string
  updatedAt?: Date | string
  [key: string]: unknown
}
