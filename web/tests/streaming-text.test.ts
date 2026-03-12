import test from 'node:test'
import assert from 'node:assert/strict'
import { getNextStreamingText, hasPendingStreamingText } from '../src/lib/streaming-text'

test('advances streaming text in larger smooth batches', () => {
  assert.equal(getNextStreamingText('你', '你正在阅读这本书', 4), '你正在阅读')
  assert.equal(getNextStreamingText('你正在阅读', '你正在阅读这本书', 4), '你正在阅读这本书')
})

test('detects whether streaming text still has pending characters', () => {
  assert.equal(hasPendingStreamingText('', '你好'), true)
  assert.equal(hasPendingStreamingText('你', '你好'), true)
  assert.equal(hasPendingStreamingText('你好', '你好'), false)
})
