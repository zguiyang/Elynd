import { inject } from '@adonisjs/core'
import Book from '#models/book'
import { BookProgressService } from './book_progress_service.js'
import Tag from '#models/tag'

export interface RecommendedBook {
  id: number
  title: string
  level: {
    id: number
    code: string
    description: string
    minWords: number | null
    maxWords: number | null
    sortOrder: number
  }
  description: string | null
  tags: Tag[]
}

@inject()
export class RecommendationService {
  constructor(private bookProgressService: BookProgressService) {}

  async getRecommendations(userId: number, limit = 6): Promise<RecommendedBook[]> {
    const readBookIds = await this.bookProgressService.getReadBookIds(userId)
    const userReadTags = await this.bookProgressService.getUserReadTags(userId)
    const userMaxDifficulty = await this.bookProgressService.getUserMaxDifficultyLevel(userId)

    const books = await Book.query()
      .where('isPublished', true)
      .preload('level')
      .preload('tags')
      .orderBy('createdAt', 'desc')
      .limit(50)

    const scoredBooks: { book: Book; score: number }[] = []

    for (const book of books) {
      if (readBookIds.includes(book.id)) {
        continue
      }

      let score = 0
      const bookTags = (book as unknown as { tags: Tag[] }).tags || []

      for (const tag of bookTags) {
        if (userReadTags.includes(tag.name)) {
          score += 2
          break
        }
      }

      const bookLevel = book.level?.sortOrder || 0
      if (bookLevel <= userMaxDifficulty + 1) {
        score += 1
      }

      scoredBooks.push({ book, score })
    }

    scoredBooks.sort((a, b) => b.score - a.score)

    const recommendations: RecommendedBook[] = scoredBooks.slice(0, limit).map(({ book }) => ({
      id: book.id,
      title: book.title,
      level: {
        id: book.level.id,
        code: book.level.code,
        description: book.level.description,
        minWords: book.level.minWords,
        maxWords: book.level.maxWords,
        sortOrder: book.level.sortOrder,
      },
      description: book.description,
      tags: (book as unknown as { tags: Tag[] }).tags || [],
    }))

    if (recommendations.length < limit) {
      const existingIds = new Set(recommendations.map((r) => r.id))
      const existingReadIds = new Set(readBookIds)

      const additionalBooks = books
        .filter((a) => !existingIds.has(a.id) && !existingReadIds.has(a.id))
        .slice(0, limit - recommendations.length)

      for (const book of additionalBooks) {
        recommendations.push({
          id: book.id,
          title: book.title,
          level: {
            id: book.level.id,
            code: book.level.code,
            description: book.level.description,
            minWords: book.level.minWords,
            maxWords: book.level.maxWords,
            sortOrder: book.level.sortOrder,
          },
          description: book.description,
          tags: (book as unknown as { tags: Tag[] }).tags || [],
        })
      }
    }

    return recommendations
  }

  async getRecommendationsForNewUser(limit = 6): Promise<RecommendedBook[]> {
    const books = await Book.query()
      .where('isPublished', true)
      .preload('level')
      .preload('tags')
      .orderBy('createdAt', 'desc')
      .limit(limit)

    return books.map((book) => ({
      id: book.id,
      title: book.title,
      level: {
        id: book.level.id,
        code: book.level.code,
        description: book.level.description,
        minWords: book.level.minWords,
        maxWords: book.level.maxWords,
        sortOrder: book.level.sortOrder,
      },
      description: book.description,
      tags: (book as unknown as { tags: Tag[] }).tags || [],
    }))
  }
}
