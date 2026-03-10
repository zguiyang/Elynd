/**
 * Full user configuration for book generation
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
  languageTransfer: string
  commonChallenges: string[]
  contentStyle: string
  vocabularyRules: string
  sentenceGuidelines: string
  authenticityNotes: string
}

/**
 * Step 1: Strategy Analysis
 * Analyze topic, determine content type, tone, themes
 */
export interface BookStrategy {
  primaryOutputType: string
  contentSubtype: string
  tone: string
  suggestedChapterCount: number
  culturalContext: string
  keyThemes: string[]
  estimatedWordCount: number
  generationHints: string
}

/**
 * Step 2: AI Self-Planning
 * Let AI define boundaries, rules, and guidelines
 */
export interface AiPlanning {
  mustFollowRules: string[]
  strictBoundaries: string[]
  authenticityAndNaturalness: string[]
  levelSpecificAdjustments: string[]
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
    ageGroup?: string
  }>
  scenes: Array<{
    location: string
    atmosphere: string
    timeOfDay?: string
    sensoryDetails?: string
  }>
  dialogueStyle: {
    overallStyle: string
    naturalnessRules: string
    levelAdaptation: string
  }
}

/**
 * Step 4: Outline Generation
 * Book title and chapter structure
 */
export interface BookOutline {
  title: string
  chapters: Array<{
    index: number
    title: string
    summary: string
  }>
  estimatedWordCount: number
  structureNote?: string
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
  totalSelected: number
}

/**
 * Step 8: Tags
 * Generated tags in native language
 */
export interface BookTags {
  tags: Array<{
    name: string
    isNew: boolean
  }>
}

/**
 * Pipeline input parameters
 */
export interface GenerateBookParams {
  topic: string
  difficultyLevel: string
  extraInstructions?: string
}
