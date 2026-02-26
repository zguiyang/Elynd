import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

request.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  const token = authStore.token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.token = null
      authStore.user = null
      
      // 只有在非登录/注册等白名单页面时才执行强制跳转，防止无限重定向
      if (!window.location.pathname.startsWith('/auth/')) {
        window.location.href = '/auth/sign-in'
      }
    }
    return Promise.reject(error)
  }
)

export default request
