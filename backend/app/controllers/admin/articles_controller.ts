import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { dispatch } from 'adonisjs-jobs/services/main'
import GenerateArticleJob from '#jobs/generate_article_job'
import { TransmitService } from '#services/transmit_service'
import { generateArticleValidator } from '#validators/article_validator'

@inject()
export default class AdminArticlesController {
  constructor(private transmitService: TransmitService) {}

  async generate({ auth, request }: HttpContext) {
    const user = auth.user!
    const data = await request.validateUsing(generateArticleValidator)

    const jobId = (await dispatch(GenerateArticleJob, {
      userId: user.id,
      difficultyLevel: data.difficultyLevel,
      topic: data.topic,
      extraInstructions: data.extraInstructions,
    })) as string | undefined

    const resolvedJobId = jobId || `manual-${Date.now()}`

    await this.transmitService.toUser(`user:${user.id}:article`, 'article:status', {
      jobId: resolvedJobId,
      status: 'queued',
      progress: 0,
      message: '已加入生成队列',
    })

    return { jobId: resolvedJobId, status: 'queued' }
  }
}
