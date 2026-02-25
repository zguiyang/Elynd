import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = document.cookie
    .split('; ')
    .find((row) => row.startsWith('auth_token='))
    ?.split('=')[1]

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      document.cookie = 'auth_token=; Max-Age=-99999999; path=/'
      window.location.href = '/auth/sign-in'
    }
    return Promise.reject(error)
  }
)

export { api }
