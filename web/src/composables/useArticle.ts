import { articleApi } from '@/api/article'
import { useRequest } from './useRequest'
import type { Article, ArticleListItem, ArticleListParams, Chapter, Tag } from '@/types/article'

export function useArticles() {
  const articles = ref<ArticleListItem[]>([])
  const tags = ref<Tag[]>([])
  const isLoading = ref(false)
  const error = ref<unknown>(null)
  const pagination = ref({
    currentPage: 1,
    perPage: 20,
    lastPage: 1,
    total: 0,
  })

  const fetchArticles = async (params?: ArticleListParams) => {
    const request = useRequest<ArticleListItem[]>({
      fetcher: async () => {
        const response = await articleApi.list(params)
        return response.data
      },
    })
    const result = await request.execute()
    if (result) {
      articles.value = result
    }
    isLoading.value = request.isLoading.value
    error.value = request.error.value
  }

  const fetchTags = async () => {
    const request = useRequest<Tag[]>({
      fetcher: async () => {
        const response = await articleApi.getTags()
        return response
      },
    })
    const result = await request.execute()
    if (result) {
      tags.value = result
    }
  }

  const goToPage = async (page: number) => {
    await fetchArticles({ page })
  }

  return {
    articles,
    tags,
    isLoading,
    error,
    pagination,
    fetchArticles,
    fetchTags,
    goToPage,
  }
}

export function useArticle() {
  const article = ref<Article | null>(null)
  const isLoading = ref(false)
  const error = ref<unknown>(null)

  const fetchArticle = async (id: number) => {
    const request = useRequest<Article>({
      fetcher: async () => {
        const response = await articleApi.getById(id)
        return response
      },
    })
    const result = await request.execute()
    if (result) {
      article.value = result
    }
    isLoading.value = request.isLoading.value
    error.value = request.error.value
  }

  return {
    article,
    isLoading,
    error,
    fetchArticle,
  }
}

export function useChapter() {
  const chapter = ref<Chapter | null>(null)
  const isLoading = ref(false)
  const error = ref<unknown>(null)

  const fetchChapter = async (articleId: number, chapterIndex: number) => {
    const request = useRequest<Chapter>({
      fetcher: async () => {
        const response = await articleApi.getChapter(articleId, chapterIndex)
        return response
      },
    })
    const result = await request.execute()
    if (result) {
      chapter.value = result
    }
    isLoading.value = request.isLoading.value
    error.value = request.error.value
  }

  return {
    chapter,
    isLoading,
    error,
    fetchChapter,
  }
}
