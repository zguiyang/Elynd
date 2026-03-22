const DEFAULT_AUDIO_MIME_TYPE = 'audio/mp3'

export const toAudioSrc = (value: string, mimeType: string = DEFAULT_AUDIO_MIME_TYPE): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (
    trimmed.startsWith('data:audio/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed
  }

  return `data:${mimeType};base64,${trimmed.replace(/\s+/g, '')}`
}
