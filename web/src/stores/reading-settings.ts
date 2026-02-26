export type FontSize = 'sm' | 'base' | 'lg' | 'xl'
export type LineHeight = 'compact' | 'normal' | 'relaxed'
export type ContentWidth = 'narrow' | 'medium' | 'wide'

export interface ReadingSettingsState {
  fontSize: FontSize
  lineHeight: LineHeight
  contentWidth: ContentWidth
}

const FONT_SIZE_ORDER: FontSize[] = ['sm', 'base', 'lg', 'xl']
const FONT_SIZE_CSS: Record<FontSize, string> = {
  sm: '16px',
  base: '18px',
  lg: '20px',
  xl: '22px',
}
const LINE_HEIGHT_CSS: Record<LineHeight, string> = {
  compact: '1.6',
  normal: '1.8',
  relaxed: '2.0',
}
const CONTENT_WIDTH_CSS: Record<ContentWidth, string> = {
  narrow: '600px',
  medium: '680px',
  wide: '800px',
}

export const useReadingSettingsStore = defineStore('reading-settings', () => {
  const fontSize = ref<FontSize>('base')
  const lineHeight = ref<LineHeight>('normal')
  const contentWidth = ref<ContentWidth>('medium')

  const fontSizeCss = computed(() => FONT_SIZE_CSS[fontSize.value])
  const lineHeightCss = computed(() => LINE_HEIGHT_CSS[lineHeight.value])
  const contentWidthCss = computed(() => CONTENT_WIDTH_CSS[contentWidth.value])

  const setFontSize = (size: FontSize) => {
    fontSize.value = size
  }

  const incrementFontSize = () => {
    const currentIndex = FONT_SIZE_ORDER.indexOf(fontSize.value)
    if (currentIndex < FONT_SIZE_ORDER.length - 1) {
      fontSize.value = FONT_SIZE_ORDER[currentIndex + 1]
    }
  }

  const decrementFontSize = () => {
    const currentIndex = FONT_SIZE_ORDER.indexOf(fontSize.value)
    if (currentIndex > 0) {
      fontSize.value = FONT_SIZE_ORDER[currentIndex - 1]
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
