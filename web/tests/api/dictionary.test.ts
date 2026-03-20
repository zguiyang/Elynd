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

  it('calls dictionary endpoint with encoded word and lookup context', async () => {
    vi.mocked(request).mockResolvedValue({
      word: 'can\'t',
      phonetics: [],
      meanings: [],
      meta: {
        source: 'dictionary_plus_ai',
        localizationLanguage: 'zh-CN',
      },
    } as never)

    await lookupWord('can\'t', {
      bookId: 88,
      chapterIndex: 4,
    } as never)

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/dictionary/can\'t',
      params: {
        bookId: 88,
        chapterIndex: 4,
      },
    })
  })

  it('maps 503 to unified query failure message', async () => {
    vi.mocked(request).mockRejectedValue({ status: 503, message: '' })

    await expect(lookupWord('missing')).rejects.toEqual({
      status: 503,
      message: '查询失败，请稍后重试',
    })
  })

  it('maps 429 to rate-limit error message', async () => {
    vi.mocked(request).mockRejectedValue({ status: 429, message: '' })

    await expect(lookupWord('hello')).rejects.toEqual({
      status: 429,
      message: '查词请求过于频繁，请稍后重试',
    })
  })
})
