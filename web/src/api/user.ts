import request from '@/lib/request'

export interface User {
  id: number
  fullName: string | null
  email: string
  avatar: string | null
  createdAt: string
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
}
