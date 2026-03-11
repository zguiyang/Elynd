import { test } from '@japa/runner'
import { BookChapterCleanerService } from '#services/book_chapter_cleaner_service'

test.group('BookChapterCleanerService.clean', () => {
  test('drops empty chapters', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      { title: 'Chapter 1', content: 'Content here with enough words to pass the minimum length threshold' },
      { title: 'Chapter 2', content: '' },
      { title: 'Chapter 3', content: '   ' },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 1)
    assert.equal(result.cleanedChapters[0].title, 'Chapter 1')
    assert.equal(result.stats.droppedEmpty, 2)
  })

  test('drops short chapters under threshold', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      { title: 'Chapter 1', content: 'This is a very long content with many words to exceed the threshold of thirty characters' },
      { title: 'Chapter 2', content: 'Short' },
      { title: 'Chapter 3', content: 'Tiny' },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 1)
    assert.equal(result.cleanedChapters[0].title, 'Chapter 1')
    assert.equal(result.stats.droppedShort, 2)
  })

  test('drops noisy title chapters', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      { title: 'Chapter 1', content: 'Valid content here with many words to pass threshold requirement' },
      { title: 'Preface', content: 'Some preface content with enough words to pass short threshold check' },
      { title: 'References', content: 'References content with enough words to pass threshold requirement' },
      { title: 'Copyright', content: 'Copyright content with enough words to pass threshold check' },
      { title: 'Acknowledgments', content: 'Thanks to everyone for supporting this book project work' },
      { title: 'Advertisement', content: 'Buy our product and enjoy the amazing quality features' },
      { title: 'Contents', content: 'Table of contents listing all chapters in this book section' },
      { title: 'Chapter 2', content: 'Another valid chapter with sufficient content length for requirements' },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 2)
    assert.equal(result.cleanedChapters[0].title, 'Chapter 1')
    assert.equal(result.cleanedChapters[1].title, 'Chapter 2')
    assert.equal(result.stats.droppedNoisy, 6)
  })

  test('preserves valid chapters and reindexes chapterIndex', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      { title: 'Preface', content: 'Short content here' },
      { title: 'Chapter 1', content: 'First valid chapter content with sufficient words to pass threshold' },
      { title: 'Chapter 2', content: 'Second valid chapter content with enough words to be valid and pass' },
      { title: 'Empty', content: '' },
      { title: 'Chapter 3', content: 'Third valid chapter content with sufficient word count to pass check' },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 3)
    assert.equal(result.cleanedChapters[0].chapterIndex, 0)
    assert.equal(result.cleanedChapters[1].chapterIndex, 1)
    assert.equal(result.cleanedChapters[2].chapterIndex, 2)
    assert.equal(result.cleanedChapters[0].title, 'Chapter 1')
    assert.equal(result.cleanedChapters[1].title, 'Chapter 2')
    assert.equal(result.cleanedChapters[2].title, 'Chapter 3')
  })

  test('returns correct stats for mixed scenario', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      { title: 'Preface', content: 'Preface content with enough words to pass threshold' },
      { title: 'Chapter 1', content: 'Valid content with enough words to pass threshold requirement' },
      { title: 'Chapter 2', content: '' },
      { title: 'References', content: 'References' },
      { title: 'Chapter 3', content: 'Another valid chapter with sufficient content length for requirements' },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 2)
    assert.equal(result.stats.droppedEmpty, 1)
    assert.equal(result.stats.droppedShort, 1)
    assert.equal(result.stats.droppedNoisy, 1)
    assert.equal(result.stats.totalDropped, 3)
    assert.equal(result.stats.totalInput, 5)
  })
})
