import { describe, expect, it } from 'vitest'
import { getNextStreamingText, hasPendingStreamingText } from '../src/lib/streaming-text'

describe('streaming-text', () => {
  it('advances streaming text in larger smooth batches', () => {
    expect(getNextStreamingText('你', '你正在阅读这本书', 4)).toBe('你正在阅读')
    expect(getNextStreamingText('你正在阅读', '你正在阅读这本书', 4)).toBe('你正在阅读这本书')
  })

  it('detects whether streaming text still has pending characters', () => {
    expect(hasPendingStreamingText('', '你好')).toBe(true)
    expect(hasPendingStreamingText('你', '你好')).toBe(true)
    expect(hasPendingStreamingText('你好', '你好')).toBe(false)
  })
})
