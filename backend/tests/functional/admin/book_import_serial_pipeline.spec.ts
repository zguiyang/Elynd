import { test } from '@japa/runner'
import { BOOK_IMPORT_STEP } from '#constants'
import { BOOK_IMPORT_STEP_TRANSITIONS } from '#types/book_import_pipeline'

test.group('Admin Book Import Serial Pipeline', () => {
  test('serial pipeline order should match target contract', async ({ assert }) => {
    const steps = [
      BOOK_IMPORT_STEP.PREPARE_IMPORT,
      BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
      BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
      BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
      BOOK_IMPORT_STEP.GENERATE_TTS,
      BOOK_IMPORT_STEP.FINALIZE_IMPORT,
    ]

    for (let index = 0; index < steps.length - 1; index++) {
      assert.equal(BOOK_IMPORT_STEP_TRANSITIONS[steps[index]], steps[index + 1])
    }
  })

  test('terminal states should not transition further', async ({ assert }) => {
    assert.isNull(BOOK_IMPORT_STEP_TRANSITIONS[BOOK_IMPORT_STEP.COMPLETED])
    assert.isNull(BOOK_IMPORT_STEP_TRANSITIONS[BOOK_IMPORT_STEP.FAILED])
  })
})
