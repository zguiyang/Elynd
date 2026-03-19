import { inject } from '@adonisjs/core'
import BookReadProgress from '#models/book_read_progress'
import Book from '#models/book'
import Tag from '#models/tag'

export interface BookWithProgress {
  id: number
  title: string
  level: {
    id: number
    code: string
    description: string
    sortOrder: number
  }
  progress: number
  tags: Tag[]
}

@inject()
export class BookProgressService {
  async updateProgress(
    userId: number,
    bookId: number,
    progress: number
  ): Promise<BookReadProgress> {
    const existing = await BookReadProgress.query()
      .where('userId', userId)
      .where('bookId', bookId)
      .first()

    if (existing) {
      existing.progress = progress
      await existing.save()
      return existing
    }

    return await BookReadProgress.create({
      userId,
      bookId,
      progress,
    })
  }

  async getProgress(userId: number, bookId: number): Promise<number> {
    const record = await BookReadProgress.query()
      .where('userId', userId)
      .where('bookId', bookId)
      .first()

    return record?.progress ?? 0
  }

  async getBooksInProgress(userId: number, limit = 10): Promise<BookWithProgress[]> {
    const progressRecords = await BookReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .where('progress', '<', 100)
      .orderBy('updatedAt', 'desc')
      .limit(limit)

    const result: BookWithProgress[] = []

    for (const record of progressRecords) {
      const book = await Book.find(record.bookId)
      if (book) {
        await book.load('level')
        await book.load('tags')
        const tags = book.tags
        result.push({
          id: book.id,
          title: book.title,
          level: {
            id: book.level.id,
            code: book.level.code,
            description: book.level.description,
            sortOrder: book.level.sortOrder,
          },
          progress: record.progress,
          tags,
        })
      }
    }

    return result
  }

  async getBooksReadCount(userId: number): Promise<number> {
    return await BookReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .count('* as total')
      .then((result) => Number(result[0].$extras.total))
  }

  async getReadBookIds(userId: number): Promise<number[]> {
    const records = await BookReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .select('bookId')

    return records.map((r) => r.bookId)
  }

  async getUserReadTags(userId: number): Promise<string[]> {
    const records = await BookReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .preload('book', (query) => {
        query.preload('tags')
      })

    const tagSet = new Set<string>()
    for (const record of records) {
      const book = record.book
      if (book) {
        const bookWithTags = book as unknown as { tags: Tag[] }
        for (const tag of bookWithTags.tags || []) {
          tagSet.add(tag.name)
        }
      }
    }

    return Array.from(tagSet)
  }

  async getUserMaxDifficultyLevel(userId: number): Promise<number> {
    const records = await BookReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .preload('book', (query) => {
        query.preload('level')
      })

    let maxLevel = 0
    for (const record of records) {
      const levelOrder = record.book?.level?.sortOrder || 0
      if (levelOrder > maxLevel) {
        maxLevel = levelOrder
      }
    }

    return maxLevel
  }
}
