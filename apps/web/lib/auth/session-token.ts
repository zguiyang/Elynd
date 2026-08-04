export function extractSessionToken(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const record = data as Record<string, unknown>
  if (typeof record.token === 'string') {
    return record.token
  }

  const session = record.session
  if (session && typeof session === 'object') {
    const token = (session as Record<string, unknown>).token
    if (typeof token === 'string') {
      return token
    }
  }

  return null
}
