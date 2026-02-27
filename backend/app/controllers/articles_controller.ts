import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ArticleService } from '#services/article_service'
import { TagService } from '#services/tag_service'
import { listArticleValidator } from '#validators/article_validator'

@inject()
export default class ArticlesController {
  constructor(
    private articleService: ArticleService,
    private tagService: TagService
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

  async tags({}: HttpContext) {
    const tags = await this.tagService.listAll()

    return tags.map((tag) => tag.serialize())
  }
}
