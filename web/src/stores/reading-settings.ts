export type FontSize = 14 | 16 | 18 | 20
export type LineHeight = 'compact' | 'normal' | 'relaxed'
export type ContentWidth = 'medium' | 'full'

export interface ReadingSettingsState {
  fontSize: FontSize
  lineHeight: LineHeight
  contentWidth: ContentWidth
}

const FONT_SIZE_ORDER: FontSize[] = [14, 16, 18, 20]
const FONT_SIZE_CSS: Record<FontSize, string> = {
  14: '14px',
  16: '16px',
  18: '18px',
  20: '20px',
}
const LINE_HEIGHT_CSS: Record<LineHeight, string> = {
  compact: '1.6',
  normal: '1.8',
  relaxed: '2.0',
}
const CONTENT_WIDTH_CSS: Record<ContentWidth, string> = {
  medium: '720px',
  full: '100%',
}

export const useReadingSettingsStore = defineStore('reading-settings', () => {
  const fontSize = ref<FontSize>(16)
  const lineHeight = ref<LineHeight>('normal')
  const contentWidth = ref<ContentWidth>('medium')

  const fontSizeCss = computed(() => FONT_SIZE_CSS[fontSize.value])
  const lineHeightCss = computed(() => LINE_HEIGHT_CSS[lineHeight.value])
  const contentWidthCss = computed(() => CONTENT_WIDTH_CSS[contentWidth.value])

  const fontSizeOptions: { value: FontSize; label: string }[] = [
    { value: 14, label: '14' },
    { value: 16, label: '16' },
    { value: 18, label: '18' },
    { value: 20, label: '20' },
  ]

  const setFontSize = (size: FontSize) => {
    fontSize.value = size
  }

  const incrementFontSize = () => {
    const currentIndex = FONT_SIZE_ORDER.indexOf(fontSize.value)
    if (currentIndex < FONT_SIZE_ORDER.length - 1) {
      fontSize.value = FONT_SIZE_ORDER[currentIndex + 1] as FontSize
    }
  }

  const decrementFontSize = () => {
    const currentIndex = FONT_SIZE_ORDER.indexOf(fontSize.value)
    if (currentIndex > 0) {
      fontSize.value = FONT_SIZE_ORDER[currentIndex - 1] as FontSize
    }
  }

  const setLineHeight = (height: LineHeight) => {
    lineHeight.value = height
  }

  const setContentWidth = (width: ContentWidth) => {
    contentWidth.value = width
  }

  return {
    fontSize,
    lineHeight,
    contentWidth,
    fontSizeCss,
    lineHeightCss,
    contentWidthCss,
    fontSizeOptions,
    setFontSize,
    incrementFontSize,
    decrementFontSize,
    setLineHeight,
    setContentWidth,
  }
}, {
  persist: {
    pick: ['fontSize', 'lineHeight', 'contentWidth'],
  },
})
