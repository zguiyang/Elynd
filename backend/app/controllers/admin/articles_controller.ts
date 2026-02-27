import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ArticleService } from '#services/article_service'
import { generateArticleValidator } from '#validators/article_validator'

@inject()
export default class AdminArticlesController {
  constructor(private articleService: ArticleService) {}

  async generate({ auth, request }: HttpContext) {
    const user = auth.user!
    const data = await request.validateUsing(generateArticleValidator)

    const article = await this.articleService.generateArticle(user.id, data)

    return article.serialize()
  }
}
