import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ArticleService } from '#services/article_service'
import { TagService } from '#services/tag_service'
import { ConfigService } from '#services/config_service'
import { AiService } from '#services/ai_service'
import { listArticleValidator } from '#validators/article_validator'
import { articleChatValidator } from '#validators/ai_validator'

@inject()
export default class ArticlesController {
  constructor(
    private articleService: ArticleService,
    private tagService: TagService,
    private configService: ConfigService,
    private aiService: AiService
  ) {}

  async index({ request }: HttpContext) {
    const data = await request.validateUsing(listArticleValidator)

    const articles = await this.articleService.listPublished({
      difficulty: data.difficulty,
      tagId: data.tagId,
      page: data.page,
      perPage: data.perPage,
    })

    return articles.serialize()
  }

  async show({ params }: HttpContext) {
    const article = await this.articleService.findPublishedById(params.id)

    return article.serialize()
  }

  async chapter({ params }: HttpContext) {
    const articleId = params.id
    const chapterIndex = params.chapterIndex

    await this.articleService.findPublishedById(articleId)

    const chapter = await this.articleService.getChapterByIndex(articleId, chapterIndex)

    return chapter.serialize()
  }

  async vocabulary({ params }: HttpContext) {
    const articleId = params.id

    await this.articleService.findPublishedById(articleId)

    const vocabularies = await this.articleService.getVocabularyByArticleId(articleId)

    return vocabularies.map((v) => v.serialize())
  }

  async tags({}: HttpContext) {
    const tags = await this.tagService.listAll()

    return tags.map((tag) => tag.serialize())
  }

  async aiChat({ params, request }: HttpContext) {
    const data = await request.validateUsing(articleChatValidator)

    const article = await this.articleService.findPublishedById(params.id)

    const aiConfig = await this.configService.getAiConfig()

    const systemPrompt = `你是一个专业的英语阅读助手，专门帮助用户学习英语文章。请根据用户的问题，结合提供的文章内容给出回答。

文章标题: ${data.articleTitle || article.title}
${data.chapterContent ? `文章内容:\n${data.chapterContent}` : ''}

请用简洁易懂的语言回答用户的问题，如果涉及文章内容，请引用原文。`

    const response = await this.aiService.chat(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: data.message },
      ],
      maxTokens: 1000,
    })

    return { response }
  }
}
