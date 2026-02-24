import { navigateTo } from '#app'

export const useHttpError = () => {
  const currentError = useState<unknown | null>('currentError', () => null)
  const isLoggingOut = useState('isLoggingOut', () => false)
  const toast = useToast()
  const tokenCookie = useCookie('auth_token')

  const getErrorMessage = (error: unknown): string => {
    if ((error as any)?.data?.message) {
      return (error as any).data.message
    }
    if ((error as any)?.message) {
      return (error as any).message
    }
    return '操作失败，请稍后重试'
  }

  const showToast = (title: string, message: string, color: 'error' | 'success' | 'info', icon?: string) => {
    if (import.meta.client) {
      toast.add({
        title,
        description: message,
        color,
        icon: icon || 'i-heroicons-x-mark'
      })
    }
  }

  const handle401 = () => {
    if (isLoggingOut.value) return
    isLoggingOut.value = true

    showToast('未登录或登录已过期', getErrorMessage(currentError.value), 'error', 'i-heroicons-lock-closed')

    tokenCookie.value = null

    if (import.meta.client) {
      navigateTo('/auth/sign-in')
    }

    setTimeout(() => {
      isLoggingOut.value = false
    }, 1000)
  }

  const handleError = (error: unknown) => {
    currentError.value = getErrorMessage(error)
    showToast('请求失败', getErrorMessage(error), 'error')
  }

  return {
    getErrorMessage,
    handle401,
    handleError
  }
}
