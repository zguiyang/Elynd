# Existing Feature Audit & Migration Plan

Code vs the **AI Native Language Reading Environment** bet.

Related: [`mvp-scope.md`](./mvp-scope.md) · [`roadmap.md`](./roadmap.md) · [`product-principles.md`](./product-principles.md)

Audit date: **2026-08-20** (frontend learner cleanup: **2026-08-23**). Paths below reflect engineering reality after the 2026-08-23 cleanup unless marked **archived**.

**MVP 1 module SSOT (prototypes / build scope):** [`mvp-1-modules.md`](./mvp-1-modules.md) — Phase **1a** = catalog → shelf; **1b** = import (deferred).

**2026-08-24 domain naming:** Backend uses **`/api/shelf`**, **`/api/reader/*`**, **`/api/reading-history`** (see [`engineering-vocabulary.md`](./engineering-vocabulary.md)). Legacy **`/api/learn/*`** and **`/api/progress`** are removed.

---

## 1. Verdict legend

| Verdict      | Meaning                                                            |
| ------------ | ------------------------------------------------------------------ |
| **KEEP**     | Serves reading. Continue to invest.                                |
| **REFACTOR** | Keep the capability; change shape, copy, or data model.            |
| **POSTPONE** | Not V1. Leave code; stop new features; hide from the default loop. |
| **REMOVED**  | Deleted from the codebase (was DEPRECATED). Do not reintroduce.    |

---

## 2. Existing feature audit

### 2.1 KEEP

| Area                    | Where it lives                                                             | Why it stays                                                                           |
| ----------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Auth                    | Better Auth; `apps/web/features/auth/**`; Hono `/api/auth/*`               | Needed to have a shelf and resume                                                      |
| Reader (immersive)      | `features/reader/**`; route `/read/[articleId]`                            | Core read surface (mock UI; backend reader APIs not wired yet)                         |
| Book detail             | `features/book-detail/**`; route `/discover/[articleId]`                   | Discover choice + entry to Reader (mock UI)                                            |
| Discover                | `features/discover/**`; route `/discover`                                  | Official catalog (mock UI)                                                             |
| My shelf                | `features/shelf/**`; route `/my-shelf`                                     | Default home after auth (mock UI)                                                      |
| Reading history         | `features/history/**`; route `/reading-history`                            | Calm overview over time (mock UI; backend `/api/reading-history` not wired yet)        |
| Shared content chrome   | `features/content/content-model.ts`                                        | Level labels, cover tints, body paragraph split — used by discover/shelf/history/admin |
| App shell               | `features/app-shell/app-shell.tsx`; `app/(app)/layout.tsx`                 | Logged-in chrome: SiteNav + MobileBottomNav + session gate                             |
| AI assist (in-text)     | `features/reader/reader-ai-*` (mock); `apps/backend/src/modules/assist/**` | Companion on this text                                                                 |
| Assist transcripts      | `conversation` / `conversation_message`; `modules/conversations/**`        | History of help **for this article**—not a chat home                                   |
| Translation / bilingual | `modules/translate/**`; reader bilingual toggle (mock)                     | V1 must                                                                                |
| TTS + word timings      | `modules/tts/**`, `modules/article-audio/**`                               | V1 must                                                                                |
| Reading position        | `reading_progress`; backend reader progress PATCH                          | Resume the book                                                                        |
| Reading history API     | `modules/reading-history/**`; `GET /api/reading-history`                   | Backend for reading-history metrics—not a learner page anymore                         |
| LLM / TTS admin + logs  | `features/admin/ai-*`, `tts-*`; invocation logs                            | Ops for the companion, not a learner feature                                           |
| Admin article CMS       | `features/admin/article-*` (body editor, publish)                          | Keep as **seed / ops** until import exists; not the product identity                   |

### 2.2 REFACTOR

| Area                     | Where it lives                                                                 | What’s wrong                                        | Direction                                                                         |
| ------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------- |
| Content atom             | `article` table: one short `body`, `level`, `themes`, `estimatedMinutes`       | Built for **curated 5–20 min articles**, not ebooks | Evolve toward a **document** with parts/chapters—see §4.1                         |
| Wire mock → API          | discover, shelf, history, reader, book-detail                                  | UI prototypes only                                  | Connect to `/api/articles`, `/api/shelf`, `/api/reader/*`, `/api/reading-history` |
| Short-article library v1 | [`feature-short-article-library-v1.md`](./feature-short-article-library-v1.md) | Shipped the **old** atom                            | **Archived**; new supply is import-first                                          |
| History metrics copy     | `features/history/**`                                                          | Mock data; “learning days” wording may linger       | Evolve toward reading minutes / volume when API wired                             |

### 2.3 POSTPONE (leave code; hide from V1 loop)

| Area                               | Where it lives                            | Why postpone                                                      |
| ---------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| Bookmark / highlights as a product | UI stub only                              | Easy to become LingQ/Anki. Wait until the reader is excellent     |
| Weak series / soft next            | `seriesId` / `seriesOrder` on `article`   | Course-shaped “next lesson.” Harmless in data; not a V1 narrative |
| Curated leveling as identity       | `level` easy/mid/stretch; library filters | Useful metadata; must not imply a syllabus                        |

### 2.4 REMOVED (do not reintroduce)

| Area                         | Former location (deleted)                                                                                                                                 | Why it conflicted                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Practice system**          | Learner practice UI/routes; learn practice APIs; admin practice workspace; AI `practice` / `practiceFeedback`; tables `practice_item`, `practice_attempt` | Quiz loop / course identity                                        |
| **Review system**            | `/review`; `modules/review/**`; admin review workspace; materialize job; tables `review_*`                                                                | Daily SRS-shaped queue                                             |
| Practice / review shell CTAs | Dashboard「继续练习」; Room「练几道小题」; nav「复习」                                                                                                    | Forced a second activity                                           |
| **Learner Library page**     | `features/library/**`; route `/library`                                                                                                                   | Replaced by **发现** (`/discover`) — deleted 2026-08-23            |
| **Learner learn-room UI**    | `features/learn/**`; route `/learn/:id`                                                                                                                   | Replaced by **Reader** (`/read/[articleId]`) — deleted earlier     |
| **Progress / 成长 page**     | `features/progress/**`; route `/progress`                                                                                                                 | Replaced by **阅读历史** (`/reading-history`) — deleted 2026-08-23 |
| **Dashboard home route**     | `/dashboard`                                                                                                                                              | Replaced by **我的书架** (`/my-shelf`) — deleted 2026-08-23        |

There is **no separate vocabulary product** (no word-bank / SRS tables). Lookup prompts mention a “vocabulary card” as an **assist format**—KEEP as explanation chrome, not as a deck.

### 2.5 Missing vs V1 (build)

| V1 must                 | Current state                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Content import          | **Absent.** Admin paste-only CMS. Learners cannot upload.                                   |
| Ebook parsing           | **Absent.** Explicitly deferred in old content strategy.                                    |
| Long-form reading       | Reader assumes one short `body`. No chapter TOC, no EPUB structure.                         |
| User shelf (learner UI) | **Mock** at `/my-shelf`. Backend `/api/shelf` exists but is not wired.                      |
| Discover catalog        | **Mock** at `/discover`. Backend `GET /api/articles` exists but is not wired on learner UI. |

TTS, translation, and assist exist but are wired to the short-article atom—they need to work on **imported documents**, not only CMS articles.

---

## 3. Migration plan

Practice/Review **removal is done** (2026-08-20). Remaining work is the reading loop + import.

### 3.1 Now (docs + stop-the-bleed) — done for drills

1. Treat [`mvp-scope.md`](./mvp-scope.md) and this file as SSOT. Old “Practice → Review → Progress” loop is retired (Progress kept as reading history only).
2. Do not reintroduce practice/review/SRS features or admin drill generate.
3. New work goes to **import + parse + long-form reader**, then wire existing assist/translate/TTS to that atom.

### 3.2 V1 loop (product, then engineering)

| Step | Intent          | Likely touch (when implementing)                                     |
| ---- | --------------- | -------------------------------------------------------------------- |
| 1    | Reading home    | **我的书架** = continue reading + shelf (mock → API)                 |
| 2    | Document model  | Import EPUB/text → readable document (see §4.1)                      |
| 3    | User shelf      | Wire shelf to `/api/shelf` (+ optional seed via discover)            |
| 4    | Same companion  | Assist, translate, TTS operate on the current document/chapter       |
| 5    | Progress polish | Optional: year / 30-day reading volume copy—without drills           |
| 6    | Copy            | Landing + READMEs already pointed at vision; keep UI Chinese in sync |

### 3.3 What not to do

- Do not rebuild Practice/Review “behind a flag.”
- Do not add a parallel `ebook` product beside `article` without a model decision (§4.1).
- Do not generate AI lesson text to populate the shelf.

---

## 4. Engineering notes (disclosed, not implemented here)

### 4.1 Content model fork

**Open choice (do not silently pick in a random PR):**

| Option                    | Idea                                               | Trade-off                          |
| ------------------------- | -------------------------------------------------- | ---------------------------------- |
| A. Extend `article`       | Long `body` or child `article_part` / chapter rows | Fewer tables; current APIs stretch |
| B. New `document` + parts | Book vs short text as first-class                  | Cleaner EPUB; more migration       |

Recommendation when the import task starts: **one document type with ordered parts** (chapters), whether that is new tables or `article` + children. Avoid two parallel “things you read.”

Large schema change → Ask before migrate (`core`).

### 4.2 Module priority (engineering)

| Keep investing                                | Refactor when touching                  | Gone / do not revive            |
| --------------------------------------------- | --------------------------------------- | ------------------------------- |
| `features/reader/**`, backend `learn` APIs    | `article` persistence + learner APIs    | `review` module + practice APIs |
| `assist`, `translate`, `tts`, `article-audio` | Wire mock discover/shelf/history/reader | Admin practice/review generate  |
| `ai` gateway, prompts for assist/translate    | Import/parse (new, V1)                  |                                 |
| Auth, admin LLM/TTS config                    | Conversations stay document-scoped      |                                 |
| `modules/reading-history` (API)               | History UI metrics copy                 | Learner `/progress` page        |

### 4.3 Prototypes

Legacy HTML under `prd/` was **deleted** (2026-08-20). Flows SSOT is [`prototype-flows.md`](./prototype-flows.md); visuals are [`DESIGN.md`](../../DESIGN.md). Do not reintroduce study-loop prototype screens.

---

## 5. Revision log

| Date       | Change                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-23 | Removed learner `features/library/**`, `features/progress/**`, routes `/dashboard` and `/progress`; migrated shared helpers to `features/content/content-model.ts`. |
| 2026-08-20 | Deleted `prd/` HTML prototypes; cleaned remaining study-loop copy in admin/progress.                                                                                |
| 2026-08-20 | Removed Practice/Review full stack; Progress kept as reading-history overview.                                                                                      |
| 2026-08-20 | Initial audit against AI Native Language Reading Environment; freeze practice/review; V1 = import + reader + companion.                                             |
