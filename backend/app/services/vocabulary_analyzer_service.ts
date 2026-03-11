import { inject } from '@adonisjs/core'
import natural from 'natural'
import logger from '@adonisjs/core/services/logger'
import { AiService } from '#services/ai_service'
import { ConfigService } from '#services/config_service'
import BookVocabulary from '#models/book_vocabulary'
import { AI_ERROR_CODES } from '#types/ai'
import type { AiClientConfig, AiServiceError } from '#types/ai'
import { VOCABULARY_ANALYZER } from '#constants'

export interface VocabularyCandidate {
  word: string
  lemma: string
  frequency: number
}

export interface VocabularyWithMeaning extends VocabularyCandidate {
  meaning: string
  sentence: string
}

@inject()
export class VocabularyAnalyzerService {
  private tokenizer = new natural.WordTokenizer()
  private irregularLemmas: Record<string, string> = {
    children: 'child',
    men: 'man',
    women: 'woman',
    mice: 'mouse',
    geese: 'goose',
    feet: 'foot',
    teeth: 'tooth',
    ran: 'run',
    gone: 'go',
    went: 'go',
  }

  constructor(
    private aiService: AiService,
    private configService: ConfigService
  ) {}

  tokenize(content: string): string[] {
    return this.tokenizer
      .tokenize(content.toLowerCase())
      .map((token) => token.trim())
      .filter((token) => /^[a-z][a-z'-]*$/.test(token))
  }

  lemmatize(word: string): string {
    if (this.irregularLemmas[word]) {
      return this.irregularLemmas[word]
    }

    const stemmed = natural.PorterStemmer.stem(word)
    return stemmed || word
  }

  getWordFrequency(tokens: string[]): Map<string, number> {
    const frequency = new Map<string, number>()

    for (const token of tokens) {
      const lemma = this.lemmatize(token)
      frequency.set(lemma, (frequency.get(lemma) || 0) + 1)
    }

    return frequency
  }

  filterStopWords(tokens: string[]): string[] {
    const stopwordSet = new Set(natural.stopwords)

    return tokens.filter((token) => token.length >= 3 && !stopwordSet.has(token))
  }

  extractVocabulary(content: string): VocabularyCandidate[] {
    const tokens = this.tokenize(content)
    const filteredTokens = this.filterStopWords(tokens)
    const frequency = this.getWordFrequency(filteredTokens)

    return Array.from(frequency.entries())
      .map(([lemma, count]) => ({
        word: lemma,
        lemma,
        frequency: count,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 200)
  }

  async generateMeaningsWithAI(
    bookTitle: string,
    vocabulary: VocabularyCandidate[]
  ): Promise<VocabularyWithMeaning[]> {
    if (vocabulary.length === 0) {
      return []
    }

    const aiConfig = await this.configService.getAiConfig()
    const mapped = new Map<string, { word: string; meaning: string; sentence: string }>()
    const chunks = this.chunkVocabulary(vocabulary, VOCABULARY_ANALYZER.MAX_WORDS_PER_REQUEST)

    for (const chunk of chunks) {
      const batchItems = await this.generateMeaningsForBatch(bookTitle, chunk, aiConfig)

      for (const item of batchItems) {
        mapped.set(item.word.toLowerCase(), item)
      }
    }

    return vocabulary.map((item) => {
      const generated = mapped.get(item.word.toLowerCase())

      return {
        ...item,
        meaning: generated?.meaning || '',
        sentence: generated?.sentence || '',
      }
    })
  }

  private chunkVocabulary(
    items: VocabularyCandidate[],
    chunkSize: number
  ): VocabularyCandidate[][] {
    const chunks: VocabularyCandidate[][] = []

    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize))
    }

    return chunks
  }

  private async generateMeaningsForBatch(
    bookTitle: string,
    vocabulary: VocabularyCandidate[],
    aiConfig: AiClientConfig
  ): Promise<Array<{ word: string; meaning: string; sentence: string }>> {
    try {
      const response = await this.requestMeanings(bookTitle, vocabulary, aiConfig)
      return response.words || []
    } catch (error) {
      if (
        this.isParseError(error) &&
        vocabulary.length > VOCABULARY_ANALYZER.MIN_WORDS_PER_REQUEST
      ) {
        const splitAt = Math.ceil(vocabulary.length / 2)
        const left = await this.generateMeaningsForBatch(
          bookTitle,
          vocabulary.slice(0, splitAt),
          aiConfig
        )
        const right = await this.generateMeaningsForBatch(
          bookTitle,
          vocabulary.slice(splitAt),
          aiConfig
        )
        return [...left, ...right]
      }

      logger.warn(
        { err: error, bookTitle, batchSize: vocabulary.length },
        'Failed to generate meanings for vocabulary batch'
      )
      return []
    }
  }

  private requestMeanings(
    bookTitle: string,
    vocabulary: VocabularyCandidate[],
    aiConfig: AiClientConfig
  ) {
    const words = vocabulary.map((item) => item.word)

    return this.aiService.chatJson<{
      words: Array<{ word: string; meaning: string; sentence: string }>
    }>(aiConfig, {
      messages: [
        {
          role: 'system',
          content:
            'You are an English vocabulary assistant. Return strict JSON with key "words". No markdown.',
        },
        {
          role: 'user',
          content: `Book title: ${bookTitle}\nGenerate concise Chinese meaning and one English example sentence for each word.\nWords: ${words.join(', ')}`,
        },
      ],
      maxTokens: VOCABULARY_ANALYZER.MEANING_MAX_TOKENS,
      temperature: 0.3,
      responseFormat: { type: 'json_object' },
    })
  }

  private isParseError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.name === 'AiServiceError' &&
      (error as AiServiceError).code === AI_ERROR_CODES.PARSE_ERROR
    )
  }

  async saveVocabulary(bookId: number, items: VocabularyWithMeaning[]) {
    if (items.length === 0) {
      return
    }

    const existing = await BookVocabulary.query().where('bookId', bookId)
    const existingMap = new Map(existing.map((item) => [item.lemma || item.word, item]))

    for (const item of items) {
      const current = existingMap.get(item.lemma)

      if (current && current.meaning && current.sentence) {
        continue
      }

      if (current) {
        await current
          .merge({
            word: item.word,
            lemma: item.lemma,
            frequency: item.frequency,
            meaning: item.meaning || current.meaning,
            sentence: item.sentence || current.sentence,
          })
          .save()
        continue
      }

      await BookVocabulary.create({
        bookId,
        word: item.word,
        lemma: item.lemma,
        frequency: item.frequency,
        meaning: item.meaning,
        sentence: item.sentence,
        phonetic: null,
      })
    }
  }
}
