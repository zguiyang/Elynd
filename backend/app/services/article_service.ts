import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import Article from '#models/article'
import ArticleChapter from '#models/article_chapter'
import ArticleVocabulary from '#models/article_vocabulary'
import GenerateArticleAudioJob from '#jobs/generate_article_audio_job'
import type { ListPublishedParams } from '#types/article'

@inject()
export class ArticleService {
  async listPublished(params: ListPublishedParams) {
    const query = Article.query()
      .where('isPublished', true)
      .preload('tags')
      .preload('chapters', (chapterQuery) => {
        chapterQuery.select('id', 'articleId', 'chapterIndex', 'title')
      })

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
      .preload('chapters', (chapterQuery) => {
        chapterQuery.select('id', 'articleId', 'chapterIndex', 'title')
      })
      .first()

    if (!article) {
      throw new Exception('Article not found', { status: 404 })
    }

    return article
  }

  async findById(id: number) {
    const article = await Article.query()
      .where('id', id)
      .preload('tags')
      .preload('chapters', (chapterQuery) => {
        chapterQuery.select('id', 'articleId', 'chapterIndex', 'title')
      })
      .first()

    if (!article) {
      throw new Exception('Article not found', { status: 404 })
    }

    return article
  }

  async getChapterByIndex(articleId: number, chapterIndex: number) {
    const chapter = await ArticleChapter.query()
      .where('articleId', articleId)
      .where('chapterIndex', chapterIndex)
      .first()

    if (!chapter) {
      throw new Exception('Chapter not found', { status: 404 })
    }

    return chapter
  }

  async getVocabularyByArticleId(articleId: number) {
    const vocabularies = await ArticleVocabulary.query()
      .where('articleId', articleId)
      .orderBy('id', 'asc')

    return vocabularies
  }

  async retryAudioGeneration(articleId: number) {
    const article = await Article.find(articleId)

    if (!article) {
      throw new Exception('Article not found', { status: 404 })
    }

    if (article.audioStatus !== 'failed') {
      throw new Exception('Can only retry articles with failed audio status', { status: 400 })
    }

    await db.transaction(async (trx) => {
      await article.useTransaction(trx).merge({ audioStatus: 'pending' }).save()
    })

    await GenerateArticleAudioJob.dispatch({ articleId: article.id })

    return {
      articleId: article.id,
      status: 'pending',
    }
  }
}
