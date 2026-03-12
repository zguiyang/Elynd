import { test } from '@japa/runner'
import { DictionaryService } from '#services/dictionary_service'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Dictionary API contract', () => {
  test('GET /api/dictionary/:word returns the dictionary entry from the service', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Dictionary User',
      emailPrefix: 'dictionary',
    })
    const originalLookup = DictionaryService.prototype.lookup

    DictionaryService.prototype.lookup = async function fakeLookup() {
      return {
        word: 'apple',
        phonetic: '/ˈæp.əl/',
        phonetics: [{ text: '/ˈæp.əl/', audio: 'https://audio.test/apple.mp3' }],
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [{ definition: 'A fruit', example: 'An apple a day.' }],
          },
        ],
      }
    }

    cleanup(async () => {
      DictionaryService.prototype.lookup = originalLookup
      await user.delete()
    })

    const response = await client
      .get('/api/dictionary/apple')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().word, 'apple')
    assert.equal(response.body().phonetic, '/ˈæp.əl/')
    assert.equal(response.body().meanings[0].definitions[0].definition, 'A fruit')
  })

  test('GET /api/dictionary/:word returns 404 when the service cannot find the word', async ({
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Dictionary User',
      emailPrefix: 'dictionary',
    })
    const originalLookup = DictionaryService.prototype.lookup

    DictionaryService.prototype.lookup = async function fakeLookup() {
      return null
    }

    cleanup(async () => {
      DictionaryService.prototype.lookup = originalLookup
      await user.delete()
    })

    const response = await client
      .get('/api/dictionary/missing-word')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(404)
  })
})
