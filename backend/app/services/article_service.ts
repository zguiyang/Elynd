import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import Article from '#models/article'
import ArticleVocabulary from '#models/article_vocabulary'
import type { ListPublishedParams } from '#types/article'

@inject()
export class ArticleService {
  async listPublished(params: ListPublishedParams) {
    const query = Article.query().where('isPublished', true).preload('tags')

    if (params.difficulty) {
      query.where('difficultyLevel', params.difficulty)
    }

    if (params.tagId) {
      const tagId = params.tagId
      query.whereHas('tags', (tagQuery) => {
        tagQuery.where('id', tagId)
      })
    }

    return query.orderBy('createdAt', 'desc').paginate(params.page || 1, params.perPage || 20)
  }

  async findPublishedById(id: number) {
    const article = await Article.query()
      .where('id', id)
      .where('isPublished', true)
      .preload('tags')
      .first()

    if (!article) {
      throw new Exception('Article not found', { status: 404 })
    }

    return article
  }

  async findById(id: number) {
    const article = await Article.query().where('id', id).preload('tags').first()

    if (!article) {
      throw new Exception('Article not found', { status: 404 })
    }

    return article
  }

  async getVocabularyByArticleId(articleId: number) {
    const vocabularies = await ArticleVocabulary.query()
      .where('articleId', articleId)
      .orderBy('id', 'asc')

    return vocabularies
  }
}
