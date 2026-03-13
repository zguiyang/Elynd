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
      userMessage: 'Please translate this section.',
    })

    assert.include(rendered, 'Test Book')
    assert.include(rendered, 'Chapter 3')
    assert.include(rendered, 'Please translate this section.')
  })

  test('renders the book semantic-clean prompt template without throwing', async ({ assert }) => {
    const { default: PromptService } = await import('#services/prompt_service')

    const promptService = new PromptService()
    const samplePayload = {
      chapters: [
        {
          title: 'Chapter 1',
          content: 'This is the first chapter with meaningful content.',
        },
        {
          title: 'Preface',
          content: 'This is a preface with some content.',
        },
        {
          title: 'Chapter 2',
          content: 'This is the second chapter with more meaningful content.',
        },
      ],
    }

    // This should not throw
    const rendered = promptService.render('book/semantic-clean', samplePayload)

    assert.isString(rendered)
    assert.include(rendered, 'Chapter 1')
    assert.include(rendered, 'Chapter 2')
  })
})
