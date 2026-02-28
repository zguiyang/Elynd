/**
 * Full user configuration for article generation
 */
export interface FullUserConfig {
  nativeLanguage: string
  targetLanguage: string
  englishVariant: string
  vocabularyLevel: string
}

/**
 * Step 0: Learner Profile
 * Generated from user configuration to guide content generation
 */
export interface LearnerProfile {
  background: string
  challenges: string[]
  preferredContentStyle: string
  vocabularyGuidelines: string
  sentenceComplexity: string
  culturalConsiderations: string
}

/**
 * Step 1: Strategy Analysis
 * Analyze topic, determine content type, tone, themes
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
 * Step 2: AI Self-Planning
 * Let AI define boundaries, rules, and guidelines
 */
export interface AiPlanning {
  writingBoundaries: string[]
  attentionPoints: string[]
  writingRules: string[]
  styleGuidelines: string[]
  authenticityGuidelines: string[]
}

/**
 * Step 3: Characters and Scenes
 * Character profiles and scene settings for realistic content
 */
export interface CharactersAndScenes {
  characters: Array<{
    name: string
    role: string
    personality: string
    speakingStyle: string
  }>
  scenes: Array<{
    location: string
    atmosphere: string
    timeOfDay?: string
  }>
  dialogueStyle: {
    style: string
    authenticityLevel: string
  }
}

/**
 * Step 4: Outline Generation
 * Article title and chapter structure
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
 * Step 5: Chapter Structure
 * Detailed structure for each chapter
 */
export interface ChapterStructure {
  index: number
  title: string
  summary: string
  keyPoints: string[]
  sections: Array<{ title: string; description: string }>
  sceneDescription?: string
  involvedCharacters?: string[]
}

/**
 * Step 5: All Chapter Structures
 */
export interface AllChapterStructures {
  chapters: ChapterStructure[]
}

/**
 * Step 6: Chapter Content
 * Generated content for each chapter
 */
export interface ChapterContent {
  index: number
  title: string
  content: string
  wordCount: number
}

/**
 * Step 7: Vocabulary
 * Extracted vocabulary with meanings in native language
 */
export interface Vocabulary {
  vocabulary: Array<{
    word: string
    meaning: string
    sentence: string
    phonetic: string
  }>
}

/**
 * Step 8: Tags
 * Generated tags in native language
 */
export interface ArticleTags {
  tags: Array<{
    name: string
    isNew: boolean
  }>
}

/**
 * Pipeline input parameters
 */
export interface GenerateArticleParams {
  topic: string
  difficultyLevel: string
  extraInstructions?: string
}
