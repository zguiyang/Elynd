import { test } from '@japa/runner'
import { BookContentGuardService } from '#services/book-parse/book_content_guard_service'

test.group('BookContentGuardService', () => {
  test('rejects html residue in chapter content', async ({ assert }) => {
    const service = new BookContentGuardService()

    const result = service.validate(`Chapter 1

This is a readable paragraph with enough words to stay valid.

id="pgepubid00000">THE TALE OF PETER RABBIT

<h2 class="no-break"`)

    assert.isFalse(result.valid)
    assert.include(result.errors, 'Content contains HTML residue')
  })

  test('accepts canonical title plus readable body', async ({ assert }) => {
    const service = new BookContentGuardService()

    const result = service.validate(`Chapter 1

This is a readable paragraph with enough words to stay valid.

Another readable paragraph keeps the chapter valid.`)

    assert.isTrue(result.valid)
  })
})
