export function useRequest<T>(options: {
  fetcher: () => Promise<T>
}) {
  const isLoading = ref(false)
  const error = ref<unknown>(null)
  const data = ref<T | null>(null)

  async function execute(): Promise<T | null> {
    isLoading.value = true
    error.value = null

    try {
      const result = await options.fetcher()
      data.value = result
      return result
    } catch (e) {
      error.value = e
      return null
    } finally {
      isLoading.value = false
    }
  }

  return { execute, data, isLoading, error }
}
