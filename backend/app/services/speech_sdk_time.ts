/**
 * Microsoft Cognitive Services Speech SDK returns timing values (like `audioOffset`, `duration`, and
 * `audioDuration`) as 100-nanosecond ticks.
 *
 * - 1 tick = 100ns
 * - 10,000 ticks = 1ms
 */

export const SPEECH_SDK_TICKS_PER_MILLISECOND = 10_000

/**
 * Convert Speech SDK 100ns ticks to milliseconds.
 */
export function speechSdkTicksToMs(ticks: number): number {
  return Math.round(ticks / SPEECH_SDK_TICKS_PER_MILLISECOND)
}
