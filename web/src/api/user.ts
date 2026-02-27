import request from '@/lib/request'

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
  me: () => request.get<User>('/api/user/me'),
  changePassword: (data: ChangePasswordData) =>
    request.post<ChangePasswordResponse>('/api/user/change-password', data),
  getConfig: () => request.get<UserConfig>('/api/user/config'),
  updateConfig: (data: UpdateUserConfigData) =>
    request.put<UserConfig>('/api/user/config', data),
}
