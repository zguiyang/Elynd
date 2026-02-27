import { articleApi } from '@/api/article'
import type { Article, ArticleListItem, ArticleListParams, Tag } from '@/types/article'

export function useArticles() {
  const articles = ref<ArticleListItem[]>([])
  const tags = ref<Tag[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    currentPage: 1,
    perPage: 20,
    lastPage: 1,
    total: 0,
  })

  const fetchArticles = async (params?: ArticleListParams) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await articleApi.list(params)
      articles.value = response.data.data
      pagination.value = response.data.meta
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '获取文章列表失败'
      error.value = message
    } finally {
      isLoading.value = false
    }
  }

  const fetchTags = async () => {
    try {
      const response = await articleApi.getTags()
      tags.value = response.data
    } catch (e: unknown) {
      console.error('Failed to fetch tags:', e)
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
  const error = ref<string | null>(null)

  const fetchArticle = async (id: number) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await articleApi.getById(id)
      article.value = response.data
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '获取文章详情失败'
      error.value = message
    } finally {
      isLoading.value = false
    }
  }

  return {
    article,
    isLoading,
    error,
    fetchArticle,
  }
}
