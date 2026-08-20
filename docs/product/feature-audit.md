# Existing Feature Audit & Migration Plan

Code vs the **AI Native Language Reading Environment** bet.

Related: [`mvp-scope.md`](./mvp-scope.md) · [`roadmap.md`](./roadmap.md) · [`product-principles.md`](./product-principles.md)

Audit date: **2026-08-20**. Paths below are current engineering reality.

**2026-08-20 removal:** Practice and Review stacks (learner UI, admin workspaces, APIs, AI drill purposes, `practice_*` / `review_*` tables) were **deleted**. Progress / 成长 is **kept** as a reading-history overview (heatmap + portrait); optimize later toward volume/summary metrics—do not rebuild drills into it.

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

| Area                       | Where it lives                                                             | Why it stays                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Auth                       | Better Auth; `apps/web/features/auth/**`; Hono `/api/auth/*`               | Needed to have a library and resume                                                                           |
| Calm reader chrome         | `features/learn/learn-room-page.tsx`, `learn-article-reader.tsx`           | Closest thing to Apple Books in the repo                                                                      |
| Selection → inline actions | `learn-article-reader.tsx` popover                                         | Local, on-demand help                                                                                         |
| AI assist (in-text)        | `features/learn/learn-help-rail.tsx`; `apps/backend/src/modules/assist/**` | Companion on this text                                                                                        |
| Assist transcripts         | `conversation` / `conversation_message`; `modules/conversations/**`        | History of help **for this article**—not a chat home                                                          |
| Translation / bilingual    | `modules/translate/**`; reader bilingual toggle                            | V1 must                                                                                                       |
| TTS + word timings         | `modules/tts/**`, `modules/article-audio/**`; `learn-audio-bar.tsx`        | V1 must                                                                                                       |
| Reading position           | `reading_progress`; learn progress PATCH                                   | Resume the book                                                                                               |
| Progress / 成长            | `features/progress/**`; `modules/progress/**`; `learner_day`               | Reading-history overview (days opened, completions, lookups). Kept; optimize later—not a study streak product |
| LLM / TTS admin + logs     | `features/admin/ai-*`, `tts-*`; invocation logs                            | Ops for the companion, not a learner feature                                                                  |
| Admin article CMS          | `features/admin/article-*` (body editor, publish)                          | Keep as **seed / ops** until import exists; not the product identity                                          |

### 2.2 REFACTOR

| Area                     | Where it lives                                                                 | What’s wrong                                          | Direction                                                       |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------- |
| Content atom             | `article` table: one short `body`, `level`, `themes`, `estimatedMinutes`       | Built for **curated 5–20 min articles**, not ebooks   | Evolve toward a **document** with parts/chapters—see §4.1       |
| Library                  | `features/library/**`; published-article catalog                               | A **team catalog**, not “my books”                    | Become the user’s shelf; seed texts are one source among others |
| Home / Dashboard         | `features/dashboard/**`; route “今日”                                          | Still catalog-shaped home                             | Reading home: resume + open shelf / import                      |
| App nav                  | `app-shell.tsx`: 今日 / 图书馆 / 成长                                          | Three spaces; Progress still in shell                 | Keep 成长 as reading history; labels may evolve                 |
| Landing copy             | `landing-copy.ts`                                                              | Was “学习空间” + Practice/Review                      | Copy aligned 2026-08-20; keep in sync with vision               |
| Assist “总结大意” chip   | `learn-help-rail.tsx` `gist`                                                   | Can become skip-the-page                              | Keep as optional assist, never as the default path              |
| Bookmark control         | learn room bookmark → “即将开放”                                               | Fine as highlight later                               | Do not ship as vocab inbox. Phase 2+ if ever                    |
| Short-article library v1 | [`feature-short-article-library-v1.md`](./feature-short-article-library-v1.md) | Shipped the **old** atom                              | Historical; new supply is import-first                          |
| Progress metrics         | portrait + heatmap                                                             | Still “learning days” wording; no year/30d volume yet | Evolve toward reading minutes / volume summary when ready       |

### 2.3 POSTPONE (leave code; hide from V1 loop)

| Area                               | Where it lives                            | Why postpone                                                      |
| ---------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| Bookmark / highlights as a product | UI stub only                              | Easy to become LingQ/Anki. Wait until the reader is excellent     |
| Weak series / soft next            | `seriesId` / `seriesOrder` on `article`   | Course-shaped “next lesson.” Harmless in data; not a V1 narrative |
| Curated leveling as identity       | `level` easy/mid/stretch; library filters | Useful metadata; must not imply a syllabus                        |

### 2.4 REMOVED (do not reintroduce)

| Area                         | Former location (deleted)                                                                                                                                 | Why it conflicted           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Practice system**          | Learner practice UI/routes; learn practice APIs; admin practice workspace; AI `practice` / `practiceFeedback`; tables `practice_item`, `practice_attempt` | Quiz loop / course identity |
| **Review system**            | `/review`; `modules/review/**`; admin review workspace; materialize job; tables `review_*`                                                                | Daily SRS-shaped queue      |
| Practice / review shell CTAs | Dashboard「继续练习」; Room「练几道小题」; nav「复习」                                                                                                    | Forced a second activity    |

There is **no separate vocabulary product** (no word-bank / SRS tables). Lookup prompts mention a “vocabulary card” as an **assist format**—KEEP as explanation chrome, not as a deck.

### 2.5 Missing vs V1 (build)

| V1 must           | Current state                                                       |
| ----------------- | ------------------------------------------------------------------- |
| Content import    | **Absent.** Admin paste-only CMS. Learners cannot upload.           |
| Ebook parsing     | **Absent.** Explicitly deferred in old content strategy.            |
| Long-form reading | Reader assumes one short `body`. No chapter TOC, no EPUB structure. |
| User library      | Library lists **published** catalog articles only.                  |

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
| 1    | Reading home    | Dashboard = continue reading + shelf / import                        |
| 2    | Document model  | Import EPUB/text → readable document (see §4.1)                      |
| 3    | User shelf      | Library shows **my** documents (+ optional seed)                     |
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

| Keep investing                                | Refactor when touching               | Gone / do not revive            |
| --------------------------------------------- | ------------------------------------ | ------------------------------- |
| `learn` reader UI                             | `article` persistence + learner APIs | `review` module + practice APIs |
| `assist`, `translate`, `tts`, `article-audio` | `library`, `dashboard` / app shell   | Admin practice/review generate  |
| `ai` gateway, prompts for assist/translate    | Import/parse (new, V1)               |                                 |
| Auth, admin LLM/TTS config                    | Conversations stay document-scoped   |                                 |
| `progress` as reading history                 | Portrait/heatmap copy & metrics      |                                 |

### 4.3 Prototypes

Legacy HTML under `prd/` was **deleted** (2026-08-20). Flows SSOT is [`prototype-flows.md`](./prototype-flows.md); visuals are [`DESIGN.md`](../../DESIGN.md). Do not reintroduce study-loop prototype screens.

---

## 5. Revision log

| Date       | Change                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-08-20 | Deleted `prd/` HTML prototypes; cleaned remaining study-loop copy in admin/progress.                                    |
| 2026-08-20 | Removed Practice/Review full stack; Progress kept as reading-history overview.                                          |
| 2026-08-20 | Initial audit against AI Native Language Reading Environment; freeze practice/review; V1 = import + reader + companion. |
