import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { ArticleService } from '#services/article_service'
import { TransmitService } from '#services/transmit_service'

interface GenerateArticlePayload {
  userId: number
  difficultyLevel: string
  topic: string
  extraInstructions?: string
}

interface ArticleStatusData {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  message: string
  article?: any
  error?: string
}

export default class GenerateArticleJob extends Job {
  static get concurrency() {
    return 1
  }

  async handle(payload: GenerateArticlePayload) {
    const jobId = String(this.job.id)
    const { userId, difficultyLevel, topic } = payload
    const channel = `user:${userId}:article`

    const articleService = await app.container.make(ArticleService)
    const transmitService = await app.container.make(TransmitService)

    const sendStatus = async (data: ArticleStatusData) => {
      await transmitService.toUser(channel, 'article:status', data)
    }

    try {
      await sendStatus({
        jobId,
        status: 'processing',
        progress: 30,
        message: '正在生成文章内容...',
      })

      const article = await articleService.generateArticle(userId, {
        difficultyLevel,
        topic,
      })

      await sendStatus({
        jobId,
        status: 'processing',
        progress: 60,
        message: '正在处理标签...',
      })

      await sendStatus({
        jobId,
        status: 'processing',
        progress: 90,
        message: '正在保存...',
      })

      await article.load('tags')

      await sendStatus({
        jobId,
        status: 'completed',
        progress: 100,
        message: '生成完成',
        article: {
          id: article.id,
          title: article.title,
          content: article.content,
          difficultyLevel: article.difficultyLevel,
          wordCount: article.wordCount,
          readingTime: article.readingTime,
          tags: article.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
          createdAt: article.createdAt,
        },
      })

      logger.info(`GenerateArticleJob completed for user ${userId}, article ${article.id}`)
    } catch (error) {
      logger.error({ err: error, jobId }, 'GenerateArticleJob failed')

      await sendStatus({
        jobId,
        status: 'failed',
        progress: 0,
        message: '生成失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }
}
