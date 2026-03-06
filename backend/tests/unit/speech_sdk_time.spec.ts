import { test } from '@japa/runner'
import { speechSdkTicksToMs } from '#utils/speech_sdk_time'

test.group('speechSdkTicksToMs', () => {
  test('converts 100ns ticks to milliseconds', ({ assert }) => {
    assert.equal(speechSdkTicksToMs(0), 0)
    assert.equal(speechSdkTicksToMs(10_000), 1)

    // 4m49s = 289s = 289_000ms
    assert.equal(speechSdkTicksToMs(2_890_000_000), 289_000)
  })

  test('rounds to the nearest millisecond', ({ assert }) => {
    assert.equal(speechSdkTicksToMs(14_999), 1)
    assert.equal(speechSdkTicksToMs(15_000), 2)
  })
})
