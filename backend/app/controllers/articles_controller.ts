import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ArticleService } from '#services/article_service'
import { TagService } from '#services/tag_service'
import { ArticleChatService } from '#services/article_chat_service'
import { listArticleValidator } from '#validators/article_validator'
import { articleChatValidator } from '#validators/ai_validator'

@inject()
export default class ArticlesController {
  constructor(
    private articleService: ArticleService,
    private tagService: TagService,
    private articleChatService: ArticleChatService
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

  async aiChat({ auth, params, request }: HttpContext) {
    const data = await request.validateUsing(articleChatValidator)
    const user = auth.getUserOrFail()

    await this.articleService.findPublishedById(params.id)

    const response = await this.articleChatService.chat({
      userId: user.id,
      articleId: params.id,
      message: data.message,
      articleTitle: data.articleTitle,
      chapterContent: data.chapterContent,
    })

    return { response }
  }
}
