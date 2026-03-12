export function hasPendingTypewriterChars(displayedContent: string, targetContent: string): boolean {
  return displayedContent.length < targetContent.length
}

export function getNextTypewriterContent(
  displayedContent: string,
  targetContent: string,
  charsPerTick = 3
): string {
  if (!hasPendingTypewriterChars(displayedContent, targetContent)) {
    return displayedContent
  }

  const nextLength = Math.min(displayedContent.length + charsPerTick, targetContent.length)
  return targetContent.slice(0, nextLength)
}
