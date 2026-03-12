import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getNextTypewriterContent,
  hasPendingTypewriterChars,
} from '../src/lib/streaming-typewriter'

test('appends only the next slice without resetting existing streamed content', () => {
  assert.equal(getNextTypewriterContent('当然', '当然可以！以下是', 3), '当然可以！')
  assert.equal(getNextTypewriterContent('当然可以！', '当然可以！以下是', 3), '当然可以！以下是')
})

test('reports whether streamed content still has pending characters', () => {
  assert.equal(hasPendingTypewriterChars('', '当然可以'), true)
  assert.equal(hasPendingTypewriterChars('当然', '当然可以'), true)
  assert.equal(hasPendingTypewriterChars('当然可以', '当然可以'), false)
})
