export function hasPendingStreamingText(displayedContent: string, targetContent: string): boolean {
  return displayedContent.length < targetContent.length
}

export function getNextStreamingText(
  displayedContent: string,
  targetContent: string,
  charsPerTick = 8
): string {
  if (!hasPendingStreamingText(displayedContent, targetContent)) {
    return displayedContent
  }

  const nextLength = Math.min(displayedContent.length + charsPerTick, targetContent.length)
  return targetContent.slice(0, nextLength)
}
