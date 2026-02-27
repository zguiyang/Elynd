import { Exception } from '@adonisjs/core/exceptions'

export class ArticleNotFoundException extends Exception {
  static status = 404
  static code = 'E_ARTICLE_NOT_FOUND'

  constructor(message = 'Article not found') {
    super(message)
  }
}

export class ArticleGenerationFailedException extends Exception {
  static status = 500
  static code = 'E_ARTICLE_GENERATION_FAILED'

  constructor(message = 'Failed to generate article') {
    super(message)
  }
}
