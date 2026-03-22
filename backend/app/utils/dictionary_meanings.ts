type DictionaryExampleSourceType = 'dictionary' | 'article' | 'ai'

export interface DictionaryMeaningExample {
  sourceText: string
  localizedText: string
  source: DictionaryExampleSourceType
}

export interface DictionaryMeaning {
  partOfSpeech: string
  localizedMeaning: string
  explanation: string
  examples: DictionaryMeaningExample[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const pickString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeExamples = (value: unknown): DictionaryMeaningExample[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    const sourceText = pickString(item.sourceText) || pickString(item.localizedText)
    const localizedText = pickString(item.localizedText) || sourceText

    if (!sourceText || !localizedText) {
      return []
    }

    return [
      {
        sourceText,
        localizedText,
        source:
          item.source === 'dictionary' || item.source === 'article' || item.source === 'ai'
            ? item.source
            : 'dictionary',
      },
    ]
  })
}

const normalizeDefinitionExamples = (value: unknown): DictionaryMeaningExample[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    const sourceText = pickString(item.sourceText) || pickString(item.definition)
    const localizedText =
      pickString(item.localizedText) || pickString(item.plainExplanation) || sourceText

    if (!sourceText || !localizedText) {
      return []
    }

    return [
      {
        sourceText,
        localizedText,
        source:
          item.source === 'dictionary' || item.source === 'article' || item.source === 'ai'
            ? item.source
            : 'dictionary',
      },
    ]
  })
}

export const normalizeDictionaryMeanings = (value: unknown): DictionaryMeaning[] => {
  if (typeof value === 'string') {
    try {
      return normalizeDictionaryMeanings(JSON.parse(value))
    } catch {
      return []
    }
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }

      const partOfSpeech = pickString(item.partOfSpeech)
      if (!partOfSpeech) {
        return null
      }

      const legacyExamples = normalizeDefinitionExamples(item.definitions)
      const examples = [...normalizeExamples(item.examples), ...legacyExamples]
      const sourceMeaning =
        pickString(item.sourceMeaning) ||
        legacyExamples[0]?.sourceText ||
        pickString(item.definition) ||
        pickString(item.localizedMeaning) ||
        partOfSpeech
      const localizedMeaning = pickString(item.localizedMeaning) || sourceMeaning
      const explanation =
        pickString(item.explanation) || pickString(item.plainExplanation) || localizedMeaning

      if (!localizedMeaning || !explanation) {
        return null
      }

      return {
        partOfSpeech,
        localizedMeaning,
        explanation,
        examples:
          examples.length > 0
            ? examples
            : [
                {
                  sourceText: sourceMeaning,
                  localizedText: localizedMeaning,
                  source: 'dictionary',
                },
              ],
      }
    })
    .filter((item): item is DictionaryMeaning => item !== null)
}
