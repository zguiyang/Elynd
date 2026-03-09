import axios, { type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 1000 * 60,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

axiosInstance.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  const token = authStore.token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message || '网络错误'

    if (status === 401) {
      const authStore = useAuthStore()
      authStore.token = null
      authStore.user = null

      if (!window.location.pathname.startsWith('/auth/')) {
        window.location.href = '/auth/sign-in'
      }
    }
    toast.error(message)
    return Promise.reject(error.response?.data || { message, error: true })
  }
)

export const request = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const res = await axiosInstance(config)
  return res.data
}

export default axiosInstance
