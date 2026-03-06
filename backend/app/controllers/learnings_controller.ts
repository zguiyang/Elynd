import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { LearningService } from '#services/learning_service'
import { ArticleProgressService } from '#services/article_progress_service'
import { RecommendationService } from '#services/recommendation_service'
import { progressValidator } from '#validators/learning'

@inject()
export default class LearningsController {
  constructor(
    private learningService: LearningService,
    private articleProgressService: ArticleProgressService,
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

    const progressRecord = await this.articleProgressService.updateProgress(
      user.id,
      data.articleId,
      data.progress
    )

    return {
      articleId: progressRecord.articleId,
      progress: progressRecord.progress,
    }
  }

  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()

    await this.learningService.updateLearningDays(user.id)

    const learningDays = await this.learningService.getLearningDays(user.id)
    const articlesReadCount = await this.articleProgressService.getArticlesReadCount(user.id)
    const continueReading = await this.articleProgressService.getArticlesInProgress(user.id, 2)
    const recommendations = await this.recommendationService.getRecommendations(user.id, 6)

    return {
      learningDays,
      articlesReadCount,
      continueReading: continueReading.map((article) => ({
        id: article.id,
        title: article.title,
        difficulty: article.difficultyLevel,
        category: article.tags[0]?.name || '未分类',
        progress: article.progress,
      })),
      recommendedArticles: recommendations.map((article) => ({
        id: article.id,
        title: article.title,
        difficulty: article.difficultyLevel,
        category: article.tags[0]?.name || '未分类',
        description: article.description,
      })),
    }
  }

  async recommend({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const recommendations = await this.recommendationService.getRecommendations(user.id, 6)

    return recommendations.map((article) => ({
      id: article.id,
      title: article.title,
      difficulty: article.difficultyLevel,
      category: article.tags[0]?.name || '未分类',
      description: article.description,
    }))
  }
}
