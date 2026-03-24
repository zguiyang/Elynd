# Chapter Translation Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement paragraph-level streaming translation with SSE push to fix Invalid JSON errors on large chapters and improve response time.

**Architecture:** Modify `TranslateChapterJob` to translate paragraphs one-by-one, writing progress to Redis. The SSE endpoint polls Redis progress every 500ms and pushes events to frontend when changes are detected. Frontend incrementally renders translated paragraphs.

**Tech Stack:** AdonisJS (backend), Vue 3 (frontend), Redis, SSE

---

## File Structure

| File | Responsibility |
|------|----------------|
| `app/services/book/chapter_translation_service.ts` | Core logic: paragraph splitting, AI translation loop, progress/Pub/Sub writing |
| `app/jobs/translate_chapter_job.ts` | Delegates to service (no change needed) |
| `app/controllers/chapter_translations_controller.ts` | SSE endpoint: subscribe to Pub/Sub, push to client |
| `web/src/views/learning/learning-book.vue` | Frontend: receive SSE events, incrementally render paragraphs |
| `web/src/api/chapter-translation.ts` | Frontend: handle new SSE event types |
| `web/src/types/book.ts` | Frontend: add new type definitions |

---

## Task 1: Extend ChapterTranslationService with Progress & Pub/Sub

**Files:**
- Modify: `app/services/book/chapter_translation_service.ts`
- Test: `backend/test/unit/services/chapter_translation_service.spec.ts`

- [ ] **Step 1: Add Redis key constants**

Find `CHAPTER_TRANSLATION` constant block in `backend/app/constants/index.ts`, extend it:
```typescript
const CHAPTER_TRANSLATION = {
  CACHE_PREFIX: 'chapter_translation',
  RESULT_TTL_SECONDS: 60 * 60 * 24 * 30,
  PROGRESS_PREFIX: 'translation_progress',
  EVENTS_PREFIX: 'translation_events',
  PROGRESS_TTL_SECONDS: 3600,
} as const
```

- [ ] **Step 2: Add progress write method**

Add after `assertValidResult()`:
```typescript
async writeTranslationProgress(
  translationId: number,
  progress: {
    totalParagraphs: number
    title: { original: string; translated: string }
    paragraphs: Array<{
      paragraphIndex: number
      status: 'pending' | 'completed' | 'failed'
      sentences?: Array<{ sentenceIndex: number; original: string; translated: string }>
      error?: string
    }>
    currentParagraph: number
    overallStatus: 'processing' | 'completed' | 'failed'
  }
): Promise<void> {
  const key = `${CHAPTER_TRANSLATION.PROGRESS_PREFIX}:${translationId}`
  await redis.setex(key, CHAPTER_TRANSLATION.PROGRESS_TTL_SECONDS, JSON.stringify(progress))
}
```

- [ ] **Step 3: Add Pub/Sub publish method**

Add after `writeTranslationProgress()`:
```typescript
async publishTranslationEvent(
  translationId: number,
  event: { type: string; [key: string]: unknown }
): Promise<void> {
  const channel = `${CHAPTER_TRANSLATION.EVENTS_PREFIX}:${translationId}`
  await redis.publish(channel, JSON.stringify(event))
}
```

- [ ] **Step 4: Add paragraph splitting helper**

Add after `publishTranslationEvent()`:
```typescript
splitContentIntoParagraphs(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n')
  const paragraphs = normalized.split('\n\n').filter(p => p.trim().length > 0)
  return paragraphs
}
```

- [ ] **Step 5: Rewrite processTranslation to be paragraph-based**

Replace the existing `processTranslation()` method (lines 178-239) with:

```typescript
async processTranslation(translationId: number): Promise<void> {
  const translation = await ChapterTranslation.find(translationId)
  if (!translation) {
    throw new Exception('Translation task not found', { status: 404 })
  }
  if (translation.status === 'completed') {
    return
  }

  const chapter = await this.findReadableChapter(translation.chapterId)
  translation.status = 'processing'
  translation.errorMessage = null
  await translation.save()

  try {
    const aiConfig = await this.configService.getAiConfig()
    const paragraphs = this.splitContentIntoParagraphs(chapter.content)

    // Initialize progress
    const progress = {
      totalParagraphs: paragraphs.length,
      title: { original: chapter.title, translated: '' },
      paragraphs: paragraphs.map((_, i) => ({
        paragraphIndex: i,
        status: 'pending' as const,
      })),
      currentParagraph: 0,
      overallStatus: 'processing' as const,
    }

    await this.writeTranslationProgress(translationId, progress)
    await this.publishTranslationEvent(translationId, {
      type: 'status',
      translationId,
      status: 'processing',
    })

    // Translate title first
    const titlePrompt = this.promptService.render('book/chapter-translation-title', {
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      title: chapter.title,
    })

    const titleResult = await this.aiService.chatJson<{ title: { original: string; translated: string } }>(
      aiConfig,
      {
        messages: [
          { role: 'system', content: 'You are a translation engine. Always output valid JSON only.' },
          { role: 'user', content: titlePrompt },
        ],
        maxTokens: 500,
        temperature: 0.1,
        responseFormat: { type: 'json_object' },
      }
    )

    progress.title = titleResult.title
    await this.writeTranslationProgress(translationId, progress)
    await this.publishTranslationEvent(translationId, {
      type: 'title',
      title: titleResult.title,
    })

    // Translate paragraphs one by one
    for (let i = 0; i < paragraphs.length; i++) {
      progress.currentParagraph = i
      await this.writeTranslationProgress(translationId, progress)

      try {
        const paragraphPrompt = this.promptService.render('book/chapter-translation-paragraph', {
          sourceLanguage: translation.sourceLanguage,
          targetLanguage: translation.targetLanguage,
          title: chapter.title,
          paragraphIndex: i + 1,
          totalParagraphs: paragraphs.length,
          paragraph: paragraphs[i],
        })

        const paragraphResult = await this.aiService.chatJson<{
          sentences: Array<{ sentenceIndex: number; original: string; translated: string }>
        }>(aiConfig, {
          messages: [
            { role: 'system', content: 'You are a translation engine. Always output valid JSON only.' },
            { role: 'user', content: paragraphPrompt },
          ],
          maxTokens: 4000,
          temperature: 0.1,
          responseFormat: { type: 'json_object' },
        })

        progress.paragraphs[i] = {
          paragraphIndex: i,
          status: 'completed',
          sentences: paragraphResult.sentences,
        }

        await this.publishTranslationEvent(translationId, {
          type: 'paragraph',
          paragraphIndex: i,
          sentences: paragraphResult.sentences,
          status: 'completed',
        })
      } catch (error) {
        progress.paragraphs[i] = {
          paragraphIndex: i,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Translation failed',
        }

        await this.publishTranslationEvent(translationId, {
          type: 'error',
          paragraphIndex: i,
          message: progress.paragraphs[i].error,
        })
      }

      await this.writeTranslationProgress(translationId, progress)

      // Rate limiting: delay between paragraphs
      if (i < paragraphs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // Finalize
    progress.overallStatus = 'completed'
    await this.writeTranslationProgress(translationId, progress)

    const result: ChapterTranslationResult = {
      title: progress.title,
      paragraphs: progress.paragraphs.map((p, i) => ({
        paragraphIndex: i,
        sentences: p.sentences || [],
      })),
    }

    translation.status = 'completed'
    translation.provider = 'openai'
    translation.model = aiConfig.model
    translation.resultJson = result
    await translation.save()

    await this.publishTranslationEvent(translationId, {
      type: 'done',
      translationId,
    })

    const cacheKey = this.buildCacheKey({
      bookId: chapter.bookId,
      chapterId: chapter.id,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      contentHash: translation.contentHash,
    })
    await this.cacheResult(cacheKey, result)
  } catch (error) {
    translation.status = 'failed'
    translation.errorMessage = error instanceof Error ? error.message : 'Translation failed'
    await translation.save()

    await this.publishTranslationEvent(translationId, {
      type: 'failed',
      translationId,
      message: translation.errorMessage,
    })

    throw error
  }
}
```

- [ ] **Step 6: Run tests**

Run: `node ace test backend/test/unit/services/chapter_translation_service.spec.ts`

---

## Task 2: Create paragraph translation prompt templates

**Files:**
- Create: `backend/resources/prompts/book/chapter-translation-title.edge`
- Create: `backend/resources/prompts/book/chapter-translation-paragraph.edge`

- [ ] **Step 1: Create title translation prompt**

```edge
Translate the following book title from {{sourceLanguage}} to {{targetLanguage}}.

Title: {{title}}

Output a valid JSON object with this structure:
{
  "title": {
    "original": "<original title>",
    "translated": "<translated title>"
  }
}
```

- [ ] **Step 2: Create paragraph translation prompt**

```edge
You are a bilingual book translation expert. Translate a single paragraph from {{sourceLanguage}} to {{targetLanguage}}.

Book Title: {{title}}
Paragraph {{paragraphIndex}} of {{totalParagraphs}}:

{{paragraph}}

Output a valid JSON object with this structure:
{
  "sentences": [
    {
      "sentenceIndex": 0,
      "original": "<original sentence>",
      "translated": "<translated sentence>"
    }
  ]
}

Requirements:
- Keep sentence boundaries clear
- Maintain the original paragraph structure
- Output valid JSON only, no explanation
```

- [ ] **Step 3: Commit**

```bash
git add -f backend/resources/prompts/book/chapter-translation-title.edge backend/resources/prompts/book/chapter-translation-paragraph.edge
git commit -m "feat(translation): add paragraph-level translation prompts"
```

---

## Task 3: Update SSE events endpoint for progress polling

**Files:**
- Modify: `app/controllers/chapter_translations_controller.ts`

**Note:** Instead of Redis Pub/Sub (which has reliability issues), we use Redis progress polling combined with change detection. The SSE endpoint polls Redis every 500ms and only sends events when progress has changed.

- [ ] **Step 1: Rewrite events endpoint with progress polling**

Replace the `events` method (lines 46-110) with:

```typescript
async events(ctx: HttpContext) {
  const translationId = Number(ctx.params.id)
  if (!Number.isInteger(translationId) || translationId <= 0) {
    throw new Exception('Invalid translation id', { status: 422 })
  }

  const sse = createSseWriter(ctx)
  sse.comment('connected')

  let timer: ReturnType<typeof setInterval> | null = null
  let lastProgress: string | null = null

  const cleanup = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  sse.onClose(() => {
    cleanup()
  })

  ctx.request.request.on('close', () => {
    cleanup()
  })

  // Initial status
  try {
    const status = await this.chapterTranslationService.getStatus(translationId)
    sse.send({
      type: 'status',
      translationId,
      status: status.status,
      errorMessage: status.errorMessage,
    })

    if (status.status === 'completed' || status.status === 'failed') {
      sse.close()
      return
    }
  } catch {
    sse.send({ type: 'error', message: 'Failed to get initial status' })
    sse.close()
    return
  }

  // Poll progress every 500ms
  timer = setInterval(async () => {
    if (sse.isClosed()) {
      cleanup()
      return
    }

    try {
      const progress = await this.chapterTranslationService.getProgress(translationId)

      if (!progress) {
        return
      }

      const currentProgress = JSON.stringify(progress)

      // Only send if progress has changed
      if (currentProgress !== lastProgress) {
        lastProgress = currentProgress

        // Send paragraph updates
        progress.paragraphs.forEach((p) => {
          if (p.status === 'completed' && p.sentences) {
            sse.send({
              type: 'paragraph',
              paragraphIndex: p.paragraphIndex,
              sentences: p.sentences,
              status: 'completed',
            })
          } else if (p.status === 'failed') {
            sse.send({
              type: 'error',
              paragraphIndex: p.paragraphIndex,
              message: p.error,
            })
          }
        })

        // Send title if translated
        if (progress.title.translated) {
          sse.send({
            type: 'title',
            title: progress.title,
          })
        }

        // Send overall status
        sse.send({
          type: 'status',
          translationId,
          status: progress.status,
          currentParagraph: progress.completedParagraphs,
          totalParagraphs: progress.totalParagraphs,
        })

        if (progress.status === 'completed' || progress.status === 'failed') {
          cleanup()
          sse.close()
        }
      }
    } catch {
      // Ignore polling errors
    }
  }, 500)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/controllers/chapter_translations_controller.ts
git commit -m "feat(translation): use progress polling for SSE real-time events"
```

---

## Task 4: Add progress query endpoint

**Files:**
- Modify: `app/controllers/chapter_translations_controller.ts`
- Modify: `app/services/book/chapter_translation_service.ts`

- [ ] **Step 1: Add getProgress method to service**

Add after `getStatus()`:
```typescript
async getProgress(translationId: number): Promise<{
  translationId: number
  status: string
  totalParagraphs: number
  completedParagraphs: number
  title: { original: string; translated: string }
  paragraphs: Array<{
    paragraphIndex: number
    status: string
    sentences?: Array<{ sentenceIndex: number; original: string; translated: string }>
    error?: string
  }>
} | null> {
  const progressKey = `${CHAPTER_TRANSLATION.PROGRESS_PREFIX}:${translationId}`
  const raw = await redis.get(progressKey)

  if (!raw) {
    // Fall back to database status
    const translation = await ChapterTranslation.find(translationId)
    if (!translation) return null

    return {
      translationId,
      status: translation.status,
      totalParagraphs: 0,
      completedParagraphs: 0,
      title: { original: '', translated: '' },
      paragraphs: [],
    }
  }

  return JSON.parse(raw)
}
```

- [ ] **Step 2: Add progress endpoint to controller**

Add after `status()` method:
```typescript
async progress({ params }: HttpContext) {
  const translationId = Number(params.id)
  if (!Number.isInteger(translationId) || translationId <= 0) {
    throw new Exception('Invalid translation id', { status: 422 })
  }

  const progress = await this.chapterTranslationService.getProgress(translationId)
  if (!progress) {
    throw new Exception('Translation not found', { status: 404 })
  }

  return progress
}
```

- [ ] **Step 3: Add route for progress endpoint**

Check `backend/start/routes.ts` for translation routes. Add:
```typescript
route.get('chapter-translations/:id/progress', '#controllers/chapter_translations_controller.progress')
```

- [ ] **Step 4: Commit**

```bash
git add app/controllers/chapter_translations_controller.ts app/services/book/chapter_translation_service.ts backend/start/routes.ts
git commit -m "feat(translation): add progress query endpoint for reconnection fallback"
```

---

## Task 5: Update frontend SSE handling

**Files:**
- Modify: `web/src/api/chapter-translation.ts`
- Modify: `web/src/types/book.ts`

- [ ] **Step 1: Add new types**

Add to `web/src/types/book.ts`:
```typescript
export interface TranslationParagraph {
  paragraphIndex: number
  sentences: TranslationSentence[]
}

export interface TranslationProgress {
  translationId: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  totalParagraphs: number
  completedParagraphs: number
  title: {
    original: string
    translated: string
  }
  paragraphs: Array<{
    paragraphIndex: number
    status: 'pending' | 'completed' | 'failed'
    sentences?: TranslationSentence[]
    error?: string
  }>
}
```

- [ ] **Step 2: Update SSE event handler**

Modify `createChapterTranslationStream` in `web/src/api/chapter-translation.ts`:

Add new event type handling in `parseMessage`:
```typescript
if (type === 'paragraph') {
  const paragraph = {
    paragraphIndex: messageData.paragraphIndex as number,
    sentences: messageData.sentences as TranslationSentence[],
  }
  fullContent += JSON.stringify(paragraph)
  onChunk?.(data)
}
```

- [ ] **Step 3: Add progress polling function**

Add export:
```typescript
export async function getChapterTranslationProgress(translationId: number): Promise<TranslationProgress> {
  const { data } = await api.get<TranslationProgress>(`/chapter-translations/${translationId}/progress`)
  return data
}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/types/book.ts web/src/api/chapter-translation.ts
git commit -m "feat(web): add SSE paragraph event handling and progress endpoint"
```

---

## Task 6: Update frontend learning-book.vue

**Files:**
- Modify: `web/src/views/learning/learning-book.vue`

- [ ] **Step 1: Add reactive progress tracking**

Add to the component:
```typescript
const translationProgress = ref<TranslationProgress | null>(null)
const translatedParagraphs = ref<Map<number, TranslationSentence[]>>(new Map())
```

- [ ] **Step 2: Update SSE onChunk handler**

In `trackTranslationTask()`, modify the `onChunk` handler:
```typescript
onChunk: (payload) => {
  const data = payload as Record<string, unknown>

  if (data.type === 'paragraph') {
    const paragraphIndex = data.paragraphIndex as number
    const sentences = data.sentences as TranslationSentence[]
    translatedParagraphs.value.set(paragraphIndex, sentences)

    // Trigger UI update
    translationStatus.value = 'processing'
  } else if (data.type === 'status') {
    translationStatus.value = data.status as string
  }
}
```

- [ ] **Step 3: Add paragraph rendering logic**

Find where paragraphs are rendered. Each paragraph should check if it has a translation:
```typescript
function getDisplayParagraph(index: number) {
  const translated = translatedParagraphs.value.get(index)
  return {
    original: paragraph.original,
    translated: translated ? translated.map(s => s.translated).join(' ') : null,
  }
}
```

- [ ] **Step 4: Add reconnection fallback**

In `startTranslationPolling()`, after SSE error:
```typescript
// Try to get current progress for reconnection
const progress = await getChapterTranslationProgress(translationId.value)
if (progress) {
  translationProgress.value = progress
  progress.paragraphs.forEach(p => {
    if (p.status === 'completed' && p.sentences) {
      translatedParagraphs.value.set(p.paragraphIndex, p.sentences)
    }
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/views/learning/learning-book.vue
git commit -m "feat(web): add incremental paragraph display for translation streaming"
```

---

## Task 7: End-to-end test

- [ ] **Step 1: Start backend server**

Run: `cd backend && npm run dev`

- [ ] **Step 2: Start frontend**

Run: `cd web && npm run dev`

- [ ] **Step 3: Test translation flow**

1. Open a book chapter in the learning view
2. Click translate button
3. Observe: paragraphs appear one by one as they are translated
4. Check console for any errors

- [ ] **Step 4: Verify error recovery**

1. Trigger a translation
2. After a few paragraphs, disconnect network
3. Reconnect and verify progress is recovered

---

## Summary

| Task | Files Modified | New Files |
|------|----------------|-----------|
| 1 | `chapter_translation_service.ts` | 0 |
| 2 | 0 | 2 prompt templates |
| 3 | `chapter_translations_controller.ts` | 0 |
| 4 | `chapter_translation_service.ts`, `chapter_translations_controller.ts`, `routes.ts` | 0 |
| 5 | `web/src/api/chapter-translation.ts`, `web/src/types/book.ts` | 0 |
| 6 | `web/src/views/learning/learning-book.vue` | 0 |

**Total: 6 files modified, 2 new files**
