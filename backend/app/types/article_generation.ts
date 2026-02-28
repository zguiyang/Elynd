/**
 * Step 0: 分析规划输出
 */
export interface ArticleStrategy {
  contentType: 'narrative' | 'expository' | 'dialogue' | 'mixed'
  tone: string
  suggestedChapterCount: number
  culturalContext: string
  keyThemes: string[]
  generationHints: string
  estimatedWordCount: number
}

/**
 * Step 1: 生成大纲输出
 */
export interface ArticleOutline {
  title: string
  chapters: Array<{
    index: number
    title: string
    summary: string
  }>
  estimatedWordCount: number
}

/**
 * Step 2: 章节内容输出
 */
export interface ChapterContent {
  index: number
  title: string
  content: string
  wordCount: number
}

/**
 * Step 3: 词汇标签输出
 */
export interface VocabularyAndTags {
  vocabulary: Array<{
    word: string
    meaning: string
    sentence: string
    phonetic: string
  }>
  tags: Array<{
    name: string
    isNew: boolean
  }>
}

/**
 * 流水线输入参数
 */
export interface GenerateArticleParams {
  topic: string
  difficultyLevel: string
  extraInstructions?: string
}
