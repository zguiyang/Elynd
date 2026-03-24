import { inject } from '@adonisjs/core'
import BookLevel from '#models/book_level'

@inject()
export class BookLevelService {
  resolveLevelByWordCount(
    levels: Array<{
      id: number
      code: string
      name: string
      description: string
      minWords: number | null
      maxWords: number | null
      sortOrder: number
      isActive: boolean
    }>,
    uniqueLemmaCount: number
  ) {
    if (levels.length === 0) {
      throw new Error('No active book levels configured')
    }

    const match = levels.find((level) => {
      if (level.minWords !== null && uniqueLemmaCount < level.minWords) {
        return false
      }
      if (level.maxWords !== null && uniqueLemmaCount > level.maxWords) {
        return false
      }
      return true
    })

    return match || levels[levels.length - 1]
  }

  async listActiveLevels() {
    return BookLevel.query()
      .where('isActive', true)
      .select('id', 'code', 'name', 'description', 'minWords', 'maxWords', 'sortOrder')
      .orderBy('sortOrder', 'asc')
  }

  async getDefaultLevel() {
    return BookLevel.query().where('isActive', true).orderBy('sortOrder', 'asc').firstOrFail()
  }

  async findById(id: number) {
    return BookLevel.query().where('id', id).where('isActive', true).first()
  }

  async getFallbackLevelByWords(uniqueLemmaCount: number) {
    const levels = await this.listActiveLevels()
    return this.resolveLevelByWordCount(levels, uniqueLemmaCount)
  }
}
