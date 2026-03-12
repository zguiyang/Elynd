import { describe, expect, it } from 'vitest'
import { updateAssistantMessageContent } from '../src/lib/chat-stream-message'

describe('chat-stream-message', () => {
  it('updates the assistant message at the tracked index', () => {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: 'question' },
      { role: 'assistant', content: '' },
    ]

    updateAssistantMessageContent(messages, 1, 'partial answer')

    expect(messages[1]!.content).toBe('partial answer')
  })

  it('ignores invalid tracked indexes', () => {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: 'question' },
      { role: 'assistant', content: '' },
    ]

    updateAssistantMessageContent(messages, null, 'partial answer')
    updateAssistantMessageContent(messages, 0, 'partial answer')

    expect(messages[0]!.content).toBe('question')
    expect(messages[1]!.content).toBe('')
  })
})
