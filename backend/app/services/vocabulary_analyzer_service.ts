import { inject } from '@adonisjs/core'
import natural from 'natural'
import { AiService } from '#services/ai_service'
import { ConfigService } from '#services/config_service'
import BookVocabulary from '#models/book_vocabulary'

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
    const words = vocabulary.map((item) => item.word)

    const response = await this.aiService.chatJson<{
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
      maxTokens: 3000,
      temperature: 0.3,
      responseFormat: { type: 'json_object' },
    })

    const mapped = new Map(
      (response.words || []).map((item) => [item.word.toLowerCase(), item] as const)
    )

    return vocabulary.map((item) => {
      const generated = mapped.get(item.word.toLowerCase())

      return {
        ...item,
        meaning: generated?.meaning || '',
        sentence: generated?.sentence || '',
      }
    })
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
