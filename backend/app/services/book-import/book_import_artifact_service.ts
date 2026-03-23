import { inject } from '@adonisjs/core'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import app from '@adonisjs/core/services/app'
import BookProcessingStepLog from '#models/book_processing_step_log'
import type { ChapterArtifactItem } from '#types/book_import_pipeline'

@inject()
export class BookImportArtifactService {
  async writeChapterArtifact(params: {
    runId: number
    bookId: number
    stepKey: string
    chapters: ChapterArtifactItem[]
  }): Promise<string> {
    const artifactsDir = app.makePath('tmp', 'book-import-artifacts')
    await mkdir(artifactsDir, { recursive: true })

    const fileName = `run-${params.runId}-book-${params.bookId}-${params.stepKey}-${Date.now()}.json`
    const artifactPath = path.join(artifactsDir, fileName)

    await writeFile(
      artifactPath,
      JSON.stringify(
        {
          runId: params.runId,
          bookId: params.bookId,
          stepKey: params.stepKey,
          chapters: params.chapters,
        },
        null,
        2
      ),
      'utf8'
    )

    return artifactPath
  }

  async readChapterArtifact(artifactPath: string): Promise<ChapterArtifactItem[]> {
    const raw = await readFile(artifactPath, 'utf8')
    const parsed = JSON.parse(raw) as { chapters?: unknown }

    if (!Array.isArray(parsed.chapters)) {
      throw new Error(`Invalid chapter artifact payload: ${artifactPath}`)
    }

    return parsed.chapters.map((chapter, index) => {
      const item = chapter as Record<string, unknown>
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const content = typeof item.content === 'string' ? item.content.trim() : ''
      const chapterIndex =
        typeof item.chapterIndex === 'number'
          ? item.chapterIndex
          : Number.parseInt(String(index), 10)

      if (!title || !content) {
        throw new Error(`Invalid chapter artifact item at index ${index}: ${artifactPath}`)
      }

      return {
        title,
        content,
        chapterIndex,
      }
    })
  }

  async getSuccessfulStepOutputRef(
    runId: number,
    stepKey: string
  ): Promise<Record<string, unknown>> {
    const stepLog = await BookProcessingStepLog.query()
      .where('runLogId', runId)
      .where('stepKey', stepKey)
      .where('status', 'success')
      .orderBy('id', 'desc')
      .first()

    if (!stepLog?.outputRef) {
      throw new Error(`Missing successful output ref for step: ${stepKey}`)
    }

    return stepLog.outputRef
  }

  requireOutputRefString(outputRef: Record<string, unknown>, key: string): string {
    const value = outputRef[key]
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Missing output reference field: ${key}`)
    }
    return value
  }
}
