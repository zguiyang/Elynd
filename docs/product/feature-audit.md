# Existing Feature Audit & Migration Plan

Code vs the **AI Native Language Reading Environment** bet. **Do not delete modules** because this doc says DEPRECATED. Hide, stop extending, then migrate.

Related: [`mvp-scope.md`](./mvp-scope.md) · [`roadmap.md`](./roadmap.md) · [`product-principles.md`](./product-principles.md)

Audit date: **2026-08-20**. Paths below are current engineering reality.

---

## 1. Verdict legend

| Verdict        | Meaning                                                               |
| -------------- | --------------------------------------------------------------------- |
| **KEEP**       | Serves reading. Continue to invest.                                   |
| **REFACTOR**   | Keep the capability; change shape, copy, or data model.               |
| **POSTPONE**   | Not V1. Leave code; stop new features; hide from the default loop.    |
| **DEPRECATED** | Conflicts with identity. Do not extend. Plan removal after V1 reader. |

---

## 2. Existing feature audit

### 2.1 KEEP

| Area                       | Where it lives                                                             | Why it stays                                                         |
| -------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Auth                       | Better Auth; `apps/web/features/auth/**`; Hono `/api/auth/*`               | Needed to have a library and resume                                  |
| Calm reader chrome         | `features/learn/learn-room-page.tsx`, `learn-article-reader.tsx`           | Closest thing to Apple Books in the repo                             |
| Selection → inline actions | `learn-article-reader.tsx` popover                                         | Local, on-demand help                                                |
| AI assist (in-text)        | `features/learn/learn-help-rail.tsx`; `apps/backend/src/modules/assist/**` | Companion on this text                                               |
| Assist transcripts         | `conversation` / `conversation_message`; `modules/conversations/**`        | History of help **for this article**—not a chat home                 |
| Translation / bilingual    | `modules/translate/**`; reader bilingual toggle                            | V1 must                                                              |
| TTS + word timings         | `modules/tts/**`, `modules/article-audio/**`; `learn-audio-bar.tsx`        | V1 must                                                              |
| Reading position           | `reading_progress`; learn progress PATCH                                   | Resume the book                                                      |
| LLM / TTS admin + logs     | `features/admin/ai-*`, `tts-*`; invocation logs                            | Ops for the companion, not a learner feature                         |
| Admin article CMS          | `features/admin/article-*` (body editor, publish)                          | Keep as **seed / ops** until import exists; not the product identity |

### 2.2 REFACTOR

| Area                     | Where it lives                                                                 | What’s wrong                                        | Direction                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Content atom             | `article` table: one short `body`, `level`, `themes`, `estimatedMinutes`       | Built for **curated 5–20 min articles**, not ebooks | Evolve toward a **document** (book/article) with parts/chapters—see §4.1     |
| Library                  | `features/library/**`; published-article catalog                               | A **team catalog**, not “my books”                  | Become the user’s shelf; seed texts are one source among others              |
| Home / Dashboard         | `features/dashboard/**`; route “今日”                                          | Study-hub: continue card + **继续练习**             | Reading home: resume + open shelf / import. Drop practice CTA                |
| App nav                  | `app-shell.tsx`: 今日 / 图书馆 / 复习 / 成长                                   | Four study spaces                                   | Reader shell: home/shelf + current book. Review/Progress off the primary nav |
| Landing copy             | `landing-copy.ts`                                                              | Was “学习空间” + Practice/Review                    | Copy aligned 2026-08-20; keep in sync with vision                            |
| Assist “总结大意” chip   | `learn-help-rail.tsx` `gist`                                                   | Can become skip-the-page                            | Keep as optional assist, never as the default path                           |
| Bookmark control         | learn room bookmark → “即将开放”                                               | Fine as highlight later                             | Do not ship as vocab inbox. Phase 2+ if ever                                 |
| Short-article library v1 | [`feature-short-article-library-v1.md`](./feature-short-article-library-v1.md) | Shipped the **old** atom                            | Historical; new supply is import-first                                       |

### 2.3 POSTPONE (leave code; hide from V1 loop)

| Area                               | Where it lives                                               | Why postpone                                                                                              |
| ---------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Progress / 成长                    | `features/progress/**`; `modules/progress/**`; `learner_day` | Habit dashboard is not the reader. Heatmap/portrait can return in Phase 3 **if** they still serve reading |
| Bookmark / highlights as a product | UI stub only                                                 | Easy to become LingQ/Anki. Wait until the reader is excellent                                             |
| Weak series / soft next            | `seriesId` / `seriesOrder` on `article`                      | Course-shaped “next lesson.” Harmless in data; not a V1 narrative                                         |
| Curated leveling as identity       | `level` easy/mid/stretch; library filters                    | Useful metadata; must not imply a syllabus                                                                |

### 2.4 DEPRECATED (do not extend; remove from UX first)

| Area                                   | Where it lives                                                                                                                                                                                                                                           | Why it conflicts                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Practice system**                    | Learner: `features/learn/practice-*.tsx`, `/learn/[id]/practice`; API in `modules/learn/service.ts`; admin generate/preview `features/admin/article-practice-*`; AI purposes `practice` + `practiceFeedback`; tables `practice_item`, `practice_attempt` | Quiz loop after reading. Course/drill identity. **Not V1.** |
| **Review system**                      | Learner: `features/review/**`, `/review`; `modules/review/**`; admin `article-review-*`; tables `review_item`, `review_session`, `review_session_item`                                                                                                   | Daily queue / SRS-adjacent. Anki-shaped. **Not V1.**        |
| Practice entry from reader             | “练几道小题” on learn room; Dashboard “继续练习”                                                                                                                                                                                                         | Forces a second activity                                    |
| Review in shell                        | Nav item 复习                                                                                                                                                                                                                                            | Makes review a co-equal product                             |
| Progress counting practice/review days | `learner_day` “opened room, review, or practice”; progress service sums practice answers                                                                                                                                                                 | Teaches the wrong north star                                |
| AI content generation for drills       | Admin practice/review **generate**                                                                                                                                                                                                                       | Adjacent to “AI content factory.” Stop new generate work    |

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

**Rule:** no drive-by deletes. Order is **product loop first**, then hide, then stop generating, then (later) remove.

### 3.1 Now (docs + stop-the-bleed) — no code required by this rewrite

1. Treat [`mvp-scope.md`](./mvp-scope.md) and this file as SSOT. Old “Practice → Review → Progress” loop is retired.
2. Do not start new practice/review/progress features or admin generate polish.
3. New work goes to **import + parse + long-form reader**, then wire existing assist/translate/TTS to that atom.

### 3.2 V1 loop (product, then engineering)

| Step | Intent             | Likely touch (when implementing)                                                                      |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| 1    | Reading home       | Dashboard CTA = continue reading only; drop 继续练习                                                  |
| 2    | Reader-first shell | Remove 复习 / 成长 from default nav (routes may stay reachable)                                       |
| 3    | Hide practice      | Remove “练几道小题”; keep `/practice` undeleted until a later removal PR                              |
| 4    | Document model     | Import EPUB/text → readable document (see §4.1)                                                       |
| 5    | User shelf         | Library shows **my** documents (+ optional seed)                                                      |
| 6    | Same companion     | Assist, translate, TTS operate on the current document/chapter                                        |
| 7    | Copy               | Landing + READMEs already pointed at vision; keep UI Chinese copy in sync when touching those screens |

### 3.3 After the reader works

| Step                                                               | Intent                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Hide admin practice/review tabs from operators (or label “legacy”) | Stop feeding the old loop                                                                 |
| Stop enqueueing practice/review generate jobs                      | Cost + identity                                                                           |
| Progress page: unlinked from shell                                 | POSTPONE, not a rewrite target                                                            |
| Later removal PR (explicit, tested)                                | Drop learner practice/review routes, then tables—**only** when V1 reader is the real loop |

### 3.4 What not to do

- Do not truncate `practice_*` / `review_*` in a “cleanup” commit.
- Do not build SRS “just behind a flag.”
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

| Keep investing                                | Refactor when touching                     | Lower priority / freeze           |
| --------------------------------------------- | ------------------------------------------ | --------------------------------- |
| `learn` reader UI                             | `article` persistence + learner APIs       | `review` module + UI              |
| `assist`, `translate`, `tts`, `article-audio` | `library`, `dashboard` / app shell         | `progress` module + UI            |
| `ai` gateway, prompts for assist/translate    | Import/parse (new, V1)                     | Admin practice/review generate    |
| Auth, admin LLM/TTS config                    | Conversations stay article/document-scoped | `learner_day` as product identity |

### 4.3 Prototypes

HTML under `prd/` still shows Library → Room → Practice → Review → Progress. [`prototype-flows.md`](./prototype-flows.md) wins. Do not implement new screens from stale Practice/Review HTML.

---

## 5. Revision log

| Date       | Change                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-08-20 | Initial audit against AI Native Language Reading Environment; freeze practice/review; V1 = import + reader + companion. |
