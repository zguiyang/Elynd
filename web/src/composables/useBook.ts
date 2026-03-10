import { bookApi } from '@/api/book'
import { useRequest } from './useRequest'
import type { Book, BookListItem, BookListParams, Chapter, Tag } from '@/types/book'

export function useBooks() {
  const books = ref<BookListItem[]>([])
  const tags = ref<Tag[]>([])
  const isLoading = ref(false)
  const error = ref<unknown>(null)
  const pagination = ref({
    currentPage: 1,
    perPage: 20,
    lastPage: 1,
    total: 0,
  })

  const fetchBooks = async (params?: BookListParams) => {
    const request = useRequest<BookListItem[]>({
      fetcher: async () => {
        const response = await bookApi.list(params)
        return response.data
      },
    })
    const result = await request.execute()
    if (result) {
      books.value = result
    }
    isLoading.value = request.isLoading.value
    error.value = request.error.value
  }

  const fetchTags = async () => {
    const request = useRequest<Tag[]>({
      fetcher: bookApi.getTags,
    })
    const result = await request.execute()
    if (result) {
      tags.value = result
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
  const error = ref<unknown>(null)

  const fetchBook = async (id: number) => {
    const request = useRequest<Book>({
      fetcher: () => bookApi.getById(id),
    })
    const result = await request.execute()
    if (result) {
      book.value = result
    }
    isLoading.value = request.isLoading.value
    error.value = request.error.value
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
  const error = ref<unknown>(null)

  const fetchChapter = async (bookId: number, chapterIndex: number) => {
    const request = useRequest<Chapter>({
      fetcher: () => bookApi.getChapter(bookId, chapterIndex),
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
