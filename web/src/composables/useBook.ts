import { bookApi } from '@/api/book'
import type { Book, BookListItem, BookListParams, Chapter, Tag } from '@/types/book'

export function useBooks() {
  const books = ref<BookListItem[]>([])
  const tags = ref<Tag[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    currentPage: 1,
    perPage: 20,
    lastPage: 1,
    total: 0,
  })

  const fetchBooks = async (params?: BookListParams) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await bookApi.list(params)
      books.value = response.data
      pagination.value = {
        currentPage: response.meta.currentPage,
        perPage: response.meta.perPage,
        lastPage: response.meta.lastPage,
        total: response.meta.total,
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch books'
    } finally {
      isLoading.value = false
    }
  }

  const fetchTags = async () => {
    try {
      const response = await bookApi.getTags()
      tags.value = response
    } catch (e) {
      console.error('Failed to fetch tags:', e)
    }
  }

  const goToPage = async (page: number) => {
    await fetchBooks({ page })
  }

  return {
    books,
    tags,
    isLoading,
    error,
    pagination,
    fetchBooks,
    fetchTags,
    goToPage,
  }
}

export function useBook() {
  const book = ref<Book | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchBook = async (id: number) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await bookApi.getById(id)
      book.value = response
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch book'
    } finally {
      isLoading.value = false
    }
  }

  return {
    book,
    isLoading,
    error,
    fetchBook,
  }
}

export function useChapter() {
  const chapter = ref<Chapter | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchChapter = async (bookId: number, chapterIndex: number) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await bookApi.getChapter(bookId, chapterIndex)
      chapter.value = response
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch chapter'
    } finally {
      isLoading.value = false
    }
  }

  return {
    chapter,
    isLoading,
    error,
    fetchChapter,
  }
}
