export interface ChapterInput {
  title: string
  content: string
}

export interface ChapterOutput extends ChapterInput {
  chapterIndex: number
}

export interface CleanStats {
  droppedEmpty: number
  droppedShort: number
  droppedNoisy: number
  totalDropped: number
  totalInput: number
}

export interface CleanResult {
  cleanedChapters: ChapterOutput[]
  stats: CleanStats
}

export class BookChapterCleanerService {
  private static readonly MIN_CONTENT_LENGTH = 30

  private static readonly NOISY_TITLES = new Set([
    'preface',
    'references',
    'copyright',
    'acknowledgments',
    'acknowledgements',
    'advertisement',
    'advertisements',
    'contents',
    'table of contents',
    'index',
    ' foreword',
    'introduction',
  ])

  /**
   * Check if a chapter title is considered noisy
   */
  private isNoisyTitle(title: string): boolean {
    const normalizedTitle = title.toLowerCase().trim()
    return BookChapterCleanerService.NOISY_TITLES.has(normalizedTitle)
  }

  /**
   * Check if content is empty or only whitespace
   */
  private isEmptyContent(content: string): boolean {
    return !content || content.trim().length === 0
  }

  /**
   * Check if content is too short
   */
  private isShortContent(content: string): boolean {
    return content.trim().length < BookChapterCleanerService.MIN_CONTENT_LENGTH
  }

  /**
   * Clean chapters by removing empty, short, and noisy title chapters
   */
  clean(chapters: ChapterInput[]): CleanResult {
    const stats: CleanStats = {
      droppedEmpty: 0,
      droppedShort: 0,
      droppedNoisy: 0,
      totalDropped: 0,
      totalInput: chapters.length,
    }

    const cleanedChapters: ChapterOutput[] = []

    for (const chapter of chapters) {
      // Check for empty content
      if (this.isEmptyContent(chapter.content)) {
        stats.droppedEmpty++
        stats.totalDropped++
        continue
      }

      // Check for short content
      if (this.isShortContent(chapter.content)) {
        stats.droppedShort++
        stats.totalDropped++
        continue
      }

      // Check for noisy title
      if (this.isNoisyTitle(chapter.title)) {
        stats.droppedNoisy++
        stats.totalDropped++
        continue
      }

      // Add valid chapter with reindexed chapterIndex
      cleanedChapters.push({
        title: chapter.title,
        content: chapter.content,
        chapterIndex: cleanedChapters.length,
      })
    }

    return {
      cleanedChapters,
      stats,
    }
  }
}
