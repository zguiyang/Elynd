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
    const rendered = promptService.render('book/semantic-metadata', {
      fileName: 'alice.txt',
      sourceType: 'user_uploaded',
      chapterTitles: ['Preface', 'Chapter 1'],
      sampleText: 'Alice was beginning to get very tired of sitting by her sister on the bank.',
    })

    assert.isString(rendered)
    assert.include(rendered, 'alice.txt')
    assert.include(rendered, 'chapterTitles')
  })

  test('renders the semantic chapters prompt template without throwing', async ({ assert }) => {
    const { default: PromptService } = await import('#services/ai/prompt_service')

    const promptService = new PromptService()
    const rendered = promptService.render('book/semantic-chapters', {
      chapters: [
        { title: 'Preface', content: 'This is the preface.' },
        { title: 'Chapter 1', content: 'This is meaningful chapter content.' },
      ],
    })

    assert.isString(rendered)
    assert.include(rendered, 'Preface')
    assert.include(rendered, 'Chapter 1')
  })

  test('renders the tag selection prompt template without throwing', async ({ assert }) => {
    const { default: PromptService } = await import('#services/ai/prompt_service')

    const promptService = new PromptService()
    const rendered = promptService.render('book/tag-selection', {
      title: 'Alice in Wonderland',
      author: 'Lewis Carroll',
      description: 'A classic fantasy adventure.',
      chapterTitles: ['Down the Rabbit-Hole'],
      sampleText: 'Alice was beginning to get very tired...',
      vocabulary: ['rabbit', 'curious', 'wonderland'],
      existingTags: ['Fantasy', 'Classic', 'Children'],
    })

    assert.isString(rendered)
    assert.include(rendered, 'Alice in Wonderland')
    assert.include(rendered, 'Fantasy')
  })
})
