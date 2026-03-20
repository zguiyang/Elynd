import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lookupWord } from '@/api/dictionary'

vi.mock('@/lib/request', () => ({
  request: vi.fn(),
}))

import { request } from '@/lib/request'

describe('dictionary api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls dictionary endpoint with encoded word', async () => {
    vi.mocked(request).mockResolvedValue({
      word: 'can\'t',
      phonetics: [],
      meanings: [],
    })

    await lookupWord('can\'t')

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/dictionary/can\'t',
    })
  })

  it('maps 404 to not-found error message', async () => {
    vi.mocked(request).mockRejectedValue({ status: 404, message: 'not found' })

    await expect(lookupWord('missing')).rejects.toEqual({
      status: 404,
      message: '未找到该单词',
    })
  })

  it('maps 429 to rate-limit error message', async () => {
    vi.mocked(request).mockRejectedValue({ status: 429, message: 'too many requests' })

    await expect(lookupWord('hello')).rejects.toEqual({
      status: 429,
      message: '查词请求过于频繁，请稍后重试',
    })
  })
})
