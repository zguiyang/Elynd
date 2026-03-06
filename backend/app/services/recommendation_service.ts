import { inject } from '@adonisjs/core'
import Article from '#models/article'
import { ArticleProgressService } from './article_progress_service.js'
import Tag from '#models/tag'

export interface RecommendedArticle {
  id: number
  title: string
  difficultyLevel: string
  description: string | null
  tags: Tag[]
}

@inject()
export class RecommendationService {
  constructor(private articleProgressService: ArticleProgressService) {}

  async getRecommendations(userId: number, limit = 6): Promise<RecommendedArticle[]> {
    const readArticleIds = await this.articleProgressService.getReadArticleIds(userId)
    const userReadTags = await this.articleProgressService.getUserReadTags(userId)
    const userMaxDifficulty = await this.articleProgressService.getUserMaxDifficultyLevel(userId)

    const articles = await Article.query()
      .where('isPublished', true)
      .preload('tags')
      .orderBy('createdAt', 'desc')
      .limit(50)

    const scoredArticles: { article: Article; score: number }[] = []

    for (const article of articles) {
      if (readArticleIds.includes(article.id)) {
        continue
      }

      let score = 0
      const articleTags = (article as unknown as { tags: Tag[] }).tags || []

      for (const tag of articleTags) {
        if (userReadTags.includes(tag.name)) {
          score += 2
          break
        }
      }

      const articleLevel = Number.parseInt(article.difficultyLevel.replace('L', ''), 10)
      if (!Number.isNaN(articleLevel) && articleLevel <= userMaxDifficulty + 1) {
        score += 1
      }

      scoredArticles.push({ article, score })
    }

    scoredArticles.sort((a, b) => b.score - a.score)

    const recommendations: RecommendedArticle[] = scoredArticles
      .slice(0, limit)
      .map(({ article }) => ({
        id: article.id,
        title: article.title,
        difficultyLevel: article.difficultyLevel,
        description: null,
        tags: (article as unknown as { tags: Tag[] }).tags || [],
      }))

    if (recommendations.length < limit) {
      const existingIds = new Set(recommendations.map((r) => r.id))
      const existingReadIds = new Set(readArticleIds)

      const additionalArticles = articles
        .filter((a) => !existingIds.has(a.id) && !existingReadIds.has(a.id))
        .slice(0, limit - recommendations.length)

      for (const article of additionalArticles) {
        recommendations.push({
          id: article.id,
          title: article.title,
          difficultyLevel: article.difficultyLevel,
          description: null,
          tags: (article as unknown as { tags: Tag[] }).tags || [],
        })
      }
    }

    return recommendations
  }

  async getRecommendationsForNewUser(limit = 6): Promise<RecommendedArticle[]> {
    const articles = await Article.query()
      .where('isPublished', true)
      .preload('tags')
      .orderBy('createdAt', 'desc')
      .limit(limit)

    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      difficultyLevel: article.difficultyLevel,
      description: null,
      tags: (article as unknown as { tags: Tag[] }).tags || [],
    }))
  }
}
