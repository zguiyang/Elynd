import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { ArticleGenerationService } from '#services/article_generation_service'
import { TransmitService } from '#services/transmit_service'
import GenerateArticleAudioJob from '#jobs/generate_article_audio_job'
import GenerateVocabularyJob from '#jobs/generate_vocabulary_job'

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

    const articleService = await app.container.make(ArticleGenerationService)
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
      await article.load('chapters', (chapterQuery) => {
        chapterQuery.select('id', 'articleId', 'chapterIndex', 'title')
      })

      await article.merge({ audioStatus: 'pending' }).save()

      await GenerateArticleAudioJob.dispatch({ articleId: article.id })
      await GenerateVocabularyJob.dispatch({ articleId: article.id })

      await sendStatus({
        jobId,
        status: 'completed',
        progress: 100,
        message: '生成完成',
        article: {
          id: article.id,
          title: article.title,
          difficultyLevel: article.difficultyLevel,
          wordCount: article.wordCount,
          readingTime: article.readingTime,
          tags: article.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
          chapters: article.chapters.map((c) => ({
            id: c.id,
            chapterIndex: c.chapterIndex,
            title: c.title,
          })),
          createdAt: article.createdAt,
        },
      })

      logger.info({ userId, articleId: article.id }, 'Article generation completed')
    } catch (error) {
      logger.error({ err: error, jobId }, 'GenerateArticleJob failed')

      // Attempt to send failure notification, ensure SSE errors don't swallow the original error
      try {
        await sendStatus({
          jobId,
          status: 'failed',
          progress: 0,
          message: '生成失败',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      } catch (sseError) {
        // Log SSE send failure but don't block original error from being thrown
        logger.error(
          { err: sseError, jobId, originalError: error },
          'Failed to send SSE failure notification'
        )
      }

      throw error
    }
  }
}
