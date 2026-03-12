import test from 'node:test'
import assert from 'node:assert/strict'
import { updateAssistantMessageContent } from '../src/lib/chat-stream-message'

test('updates the assistant message at the tracked index', () => {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: 'question' },
    { role: 'assistant', content: '' },
  ]

  updateAssistantMessageContent(messages, 1, 'partial answer')

  assert.equal(messages[1]!.content, 'partial answer')
})

test('ignores invalid tracked indexes', () => {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: 'question' },
    { role: 'assistant', content: '' },
  ]

  updateAssistantMessageContent(messages, null, 'partial answer')
  updateAssistantMessageContent(messages, 0, 'partial answer')

  assert.equal(messages[0]!.content, 'question')
  assert.equal(messages[1]!.content, '')
})
