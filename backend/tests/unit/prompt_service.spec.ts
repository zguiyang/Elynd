import { test } from '@japa/runner'

test.group('PromptService', () => {
  test('renders the book chat prompt template', async ({ assert }) => {
    const { default: PromptService } = await import('#services/prompt_service')

    const promptService = new PromptService()
    const rendered = promptService.render('book/chat', {
      nativeLanguage: 'zh',
      targetLanguage: 'en',
      bookTitle: 'Test Book',
      chapterTitle: 'Chapter 3',
      chapterContent: 'This is a test paragraph.',
      userMessage: 'Please translate this section.'
    })

    assert.include(rendered, 'Test Book')
    assert.include(rendered, 'Chapter 3')
    assert.include(rendered, 'Please translate this section.')
  })
})
