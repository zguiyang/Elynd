import { inject } from '@adonisjs/core'
import ArticleReadProgress from '#models/article_read_progress'
import Article from '#models/article'
import Tag from '#models/tag'

export interface ArticleWithProgress {
  id: number
  title: string
  difficultyLevel: string
  progress: number
  tags: Tag[]
}

@inject()
export class ArticleProgressService {
  async updateProgress(
    userId: number,
    articleId: number,
    progress: number
  ): Promise<ArticleReadProgress> {
    const existing = await ArticleReadProgress.query()
      .where('userId', userId)
      .where('articleId', articleId)
      .first()

    if (existing) {
      existing.progress = progress
      await existing.save()
      return existing
    }

    return await ArticleReadProgress.create({
      userId,
      articleId,
      progress,
    })
  }

  async getProgress(userId: number, articleId: number): Promise<number> {
    const record = await ArticleReadProgress.query()
      .where('userId', userId)
      .where('articleId', articleId)
      .first()

    return record?.progress ?? 0
  }

  async getArticlesInProgress(userId: number, limit = 10): Promise<ArticleWithProgress[]> {
    const progressRecords = await ArticleReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .where('progress', '<', 100)
      .orderBy('updatedAt', 'desc')
      .limit(limit)

    const result: ArticleWithProgress[] = []

    for (const record of progressRecords) {
      const article = await Article.find(record.articleId)
      if (article) {
        await article.load('tags')
        const tags = article.tags
        result.push({
          id: article.id,
          title: article.title,
          difficultyLevel: article.difficultyLevel,
          progress: record.progress,
          tags,
        })
      }
    }

    return result
  }

  async getArticlesReadCount(userId: number): Promise<number> {
    return await ArticleReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .count('* as total')
      .then((result) => Number(result[0].$extras.total))
  }

  async getReadArticleIds(userId: number): Promise<number[]> {
    const records = await ArticleReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .select('articleId')

    return records.map((r) => r.articleId)
  }

  async getUserReadTags(userId: number): Promise<string[]> {
    const records = await ArticleReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .preload('article', (query) => {
        query.preload('tags')
      })

    const tagSet = new Set<string>()
    for (const record of records) {
      const article = record.article
      if (article) {
        const articleWithTags = article as unknown as { tags: Tag[] }
        for (const tag of articleWithTags.tags || []) {
          tagSet.add(tag.name)
        }
      }
    }

    return Array.from(tagSet)
  }

  async getUserMaxDifficultyLevel(userId: number): Promise<number> {
    const records = await ArticleReadProgress.query()
      .where('userId', userId)
      .where('progress', '>', 0)
      .preload('article')

    let maxLevel = 0
    for (const record of records) {
      const article = record.article as unknown as { difficultyLevel: string }
      if (article?.difficultyLevel) {
        const level = Number.parseInt(article.difficultyLevel.replace('L', ''), 10)
        if (!Number.isNaN(level) && level > maxLevel) {
          maxLevel = level
        }
      }
    }

    return maxLevel
  }
}
