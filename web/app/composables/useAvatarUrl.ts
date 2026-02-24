export function useAvatarUrl() {
  const config = useRuntimeConfig()

  return (avatarPath: string | null | undefined): string | null => {
    if (!avatarPath) return null
    return `${config.public.staticFileUrl}${avatarPath}`
  }
}
