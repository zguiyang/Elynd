import type { ChatMessage } from '../api/book-chat'

export function updateAssistantMessageContent(
  messages: ChatMessage[],
  assistantMessageIndex: number | null,
  content: string
): ChatMessage[] {
  if (assistantMessageIndex === null) {
    return messages
  }

  const targetMessage = messages[assistantMessageIndex]

  if (!targetMessage || targetMessage.role !== 'assistant') {
    return messages
  }

  targetMessage.content = content
  return messages
}
