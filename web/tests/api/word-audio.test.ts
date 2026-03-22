import { describe, it, expect, vi, beforeEach } from 'vitest'
import { wordAudioApi } from '@/api/word-audio'

vi.mock('@/lib/request', () => ({
  request: vi.fn(),
}))

import { request } from '@/lib/request'

describe('word audio api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the protected word audio endpoint with an encoded word', async () => {
    vi.mocked(request).mockResolvedValue({
      audio: 'data:audio/mp3;base64,QUJD',
    } as never)

    await wordAudioApi.getWordAudio("can't!")

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/word-audio/can\'t!',
    })
  })
})
