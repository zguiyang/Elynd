export type MeaningExampleSource = 'dictionary' | 'article' | 'ai'

export interface MeaningExampleLike {
  sourceText: string
  localizedText: string
  source: MeaningExampleSource
}

export interface MeaningLike {
  examples?: MeaningExampleLike[] | null
}

export const getMeaningExamples = (meaning?: MeaningLike | null): MeaningExampleLike[] => {
  return Array.isArray(meaning?.examples) ? meaning.examples : []
}
