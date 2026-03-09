import { request } from '@/lib/request'

export interface User {
  id: number
  fullName: string | null
  email: string
  avatar: string | null
  isAdmin: boolean
  createdAt: string
}

export interface UserConfig {
  id: number
  userId: number
  nativeLanguage: string | null
  targetLanguage: string | null
  vocabularyLevel: string | null
  englishVariant: string | null
  learningInitCompleted: boolean
  createdAt: string
  updatedAt: string | null
}

export interface UpdateUserConfigData {
  nativeLanguage?: string | null
  targetLanguage?: string | null
  vocabularyLevel?: string | null
  englishVariant?: 'en-US' | 'en-GB'
  learningInitCompleted?: boolean
}

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
}

export interface ChangePasswordResponse {
  message: string
}

export const userApi = {
  me: () => request<User>({ method: 'GET', url: '/api/user/me' }),

  changePassword: (data: ChangePasswordData) =>
    request<ChangePasswordResponse>({ method: 'POST', url: '/api/user/change-password', data }),

  getConfig: () => request<UserConfig>({ method: 'GET', url: '/api/user/config' }),

  updateConfig: (data: UpdateUserConfigData) =>
    request<UserConfig>({ method: 'PUT', url: '/api/user/config', data }),
}
