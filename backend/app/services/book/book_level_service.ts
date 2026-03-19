import { inject } from '@adonisjs/core'
import BookLevel from '#models/book_level'

@inject()
export class BookLevelService {
  async listActiveLevels() {
    return BookLevel.query().where('isActive', true).orderBy('sortOrder', 'asc')
  }

  async getDefaultLevel() {
    return BookLevel.query().where('isActive', true).orderBy('sortOrder', 'asc').firstOrFail()
  }

  async findById(id: number) {
    return BookLevel.query().where('id', id).where('isActive', true).first()
  }

  async getFallbackLevelByWords(uniqueLemmaCount: number) {
    const levels = await this.listActiveLevels()
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
}
