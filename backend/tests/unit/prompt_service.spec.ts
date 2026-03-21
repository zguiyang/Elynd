import { test } from '@japa/runner'

test.group('PromptService', () => {
  test('renders the book chat prompt template', async ({ assert }) => {
    const { default: PromptService } = await import('#services/ai/prompt_service')

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

  test('renders the semantic metadata prompt template without throwing', async ({ assert }) => {
    const { default: PromptService } = await import('#services/ai/prompt_service')

    const promptService = new PromptService()
    const rendered = promptService.render('book/import/system', {})

    assert.isString(rendered)
    assert.include(rendered, 'book import assistant')
    assert.notInclude(rendered, 'Product Background')
    assert.notInclude(rendered, 'Target Users')
    assert.notInclude(rendered, 'Socratic')
  })

  test('renders the import semantic metadata prompt template without throwing', async ({
    assert,
  }) => {
    const { default: PromptService } = await import('#services/ai/prompt_service')

    const promptService = new PromptService()
    const rendered = promptService.render('book/import/semantic-metadata', {
      fileName: 'alice.txt',
      sourceType: 'user_uploaded',
      chapterTitles: ['Preface', 'Chapter 1'],
      sampleText: 'Alice was beginning to get very tired of sitting by her sister on the bank.',
    })

    assert.isString(rendered)
    assert.include(rendered, 'alice.txt')
    assert.include(rendered, 'chapterTitles')
  })
})
