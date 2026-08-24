/** Scroll container → 0–100 reading progress (integer percent). */
export function scrollProgressRatio(container: HTMLElement): number {
  const { scrollTop, scrollHeight, clientHeight } = container;
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) {
    return 100;
  }
  return Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
}

/** Ratio still pending after debounce (flush on unmount). */
export function pendingProgressFlushRatio(pending: number | null, lastSent: number): number | null {
  if (pending == null || pending === lastSent) {
    return null;
  }
  return pending;
}
