import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { LearningService } from '#services/learning_service'
import { BookProgressService } from '#services/book_progress_service'
import { RecommendationService } from '#services/recommendation_service'
import { progressValidator } from '#validators/learning'

@inject()
export default class LearningsController {
  constructor(
    private learningService: LearningService,
    private bookProgressService: BookProgressService,
    private recommendationService: RecommendationService
  ) {}

  async login({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const result = await this.learningService.updateLearningDays(user.id)

    return {
      learningDays: result.learningDays,
      isFirstLoginToday: result.isFirstLoginToday,
    }
  }

  async updateProgress({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(progressValidator)

    const progressRecord = await this.bookProgressService.updateProgress(
      user.id,
      data.bookId,
      data.progress
    )

    return {
      bookId: progressRecord.bookId,
      progress: progressRecord.progress,
    }
  }

  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()

    await this.learningService.updateLearningDays(user.id)

    const learningDays = await this.learningService.getLearningDays(user.id)
    const booksReadCount = await this.bookProgressService.getBooksReadCount(user.id)
    const continueReading = await this.bookProgressService.getBooksInProgress(user.id, 2)
    const recommendations = await this.recommendationService.getRecommendations(user.id, 6)

    return {
      learningDays,
      booksReadCount,
      continueReading: continueReading.map((book) => ({
        id: book.id,
        title: book.title,
        difficulty: book.difficultyLevel,
        category: book.tags[0]?.name || '未分类',
        progress: book.progress,
      })),
      recommendedBooks: recommendations.map((book) => ({
        id: book.id,
        title: book.title,
        difficulty: book.difficultyLevel,
        category: book.tags[0]?.name || '未分类',
        description: book.description,
      })),
    }
  }

  async recommend({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const recommendations = await this.recommendationService.getRecommendations(user.id, 6)

    return recommendations.map((book) => ({
      id: book.id,
      title: book.title,
      difficulty: book.difficultyLevel,
      category: book.tags[0]?.name || '未分类',
      description: book.description,
    }))
  }
}
