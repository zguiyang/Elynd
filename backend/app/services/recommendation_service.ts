import { inject } from '@adonisjs/core'
import Book from '#models/book'
import { BookProgressService } from './book_progress_service.js'
import Tag from '#models/tag'

export interface RecommendedBook {
  id: number
  title: string
  difficultyLevel: string
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

      const bookLevel = Number.parseInt(book.difficultyLevel.replace('L', ''), 10)
      if (!Number.isNaN(bookLevel) && bookLevel <= userMaxDifficulty + 1) {
        score += 1
      }

      scoredBooks.push({ book, score })
    }

    scoredBooks.sort((a, b) => b.score - a.score)

    const recommendations: RecommendedBook[] = scoredBooks.slice(0, limit).map(({ book }) => ({
      id: book.id,
      title: book.title,
      difficultyLevel: book.difficultyLevel,
      description: null,
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
          difficultyLevel: book.difficultyLevel,
          description: null,
          tags: (book as unknown as { tags: Tag[] }).tags || [],
        })
      }
    }

    return recommendations
  }

  async getRecommendationsForNewUser(limit = 6): Promise<RecommendedBook[]> {
    const books = await Book.query()
      .where('isPublished', true)
      .preload('tags')
      .orderBy('createdAt', 'desc')
      .limit(limit)

    return books.map((book) => ({
      id: book.id,
      title: book.title,
      difficultyLevel: book.difficultyLevel,
      description: null,
      tags: (book as unknown as { tags: Tag[] }).tags || [],
    }))
  }
}
