import { describe, expect, it } from 'vitest'
import { toAudioSrc } from '@/lib/audio'

describe('audio utils', () => {
  it('returns data uri unchanged', () => {
    expect(toAudioSrc('data:audio/mp3;base64,QUJD')).toBe('data:audio/mp3;base64,QUJD')
  })

  it('normalizes raw base64 to an audio data uri', () => {
    expect(toAudioSrc('  QUJDRA==  ')).toBe('data:audio/mp3;base64,QUJDRA==')
  })

  it('passes through urls unchanged', () => {
    expect(toAudioSrc('https://example.com/audio.mp3')).toBe('https://example.com/audio.mp3')
  })
})
