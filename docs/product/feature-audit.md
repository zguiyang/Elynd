# Existing Feature Audit & Migration Plan

Code vs the **AI Native Language Reading Environment** bet and **ReadingWork** domain (ADR-001).

Related: [`mvp-scope.md`](./mvp-scope.md) · [`roadmap.md`](./roadmap.md) · [`engineering-vocabulary.md`](./engineering-vocabulary.md) · ADR-001 [`../adr/001-reading-content-domain-model.md`](../adr/001-reading-content-domain-model.md)

Audit date: **2026-08-24** (domain docs aligned; **code still legacy Article** until Phase 3).

**MVP 1 module SSOT:** [`mvp-1-modules.md`](./mvp-1-modules.md) — Phase **1a** = admin EPUB catalog → shelf; **1b** = user import (deferred).

---

## 1. Verdict legend

| Verdict      | Meaning                                                            |
| ------------ | ------------------------------------------------------------------ |
| **KEEP**     | Serves reading. Continue to invest.                                |
| **REFACTOR** | Keep the capability; change shape to ReadingWork model (Phase 3). |
| **POSTPONE** | Not V1. Leave code; stop new features; hide from the default loop. |
| **REMOVED**  | Deleted from the codebase. Do not reintroduce.                     |
| **DELETE**   | Legacy Article-era code/tables — remove in Phase 3 (no users).      |

---

## 2. Existing feature audit

### 2.1 KEEP (capability — rebind in Phase 3)

| Area                    | Where it lives (current)                                                   | Target binding                                                          |
| ----------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Auth                    | Better Auth; `features/auth/**`; Hono `/api/auth/*`                        | Unchanged                                                               |
| Reader (immersive)      | `features/reader/**`; route `/read/[articleId]` → **`/read/[workId]`**     | Session over **ReadingWork** + current **ReadingPart**                  |
| Book detail             | `features/book-detail/**`; `/discover/[articleId]` → **`[workId]`**        | **ReadingWork** metadata                                                |
| Discover                | `features/discover/**`                                                       | Published **ReadingWork** list                                          |
| My shelf                | `features/shelf/**`                                                        | **ReadingState** read model                                             |
| Reading history         | `features/history/**`                                                        | Activity + completions by **workId**                                    |
| Shared content chrome   | `features/content/content-model.ts`                                        | Cover tints, paragraph split — drop **ArticleLevel**                    |
| App shell               | `features/app-shell/**`                                                    | Unchanged                                                               |
| AI assist (in-text)     | `modules/assist/**`, `reader-ai-*`                                         | **workId** + **partId** + selection                                     |
| Assist transcripts      | `conversation` / `conversation_message`                                    | `subject_type = reading_work`                                           |
| Translation / bilingual | `modules/translate/**`                                                     | **partId**-scoped cache                                                 |
| TTS + word timings      | `modules/tts/**`                                                           | **ContentAsset** on **ReadingPart**                                     |
| Reading position        | `reading_progress` → **`reading_state`**                                   | part + anchor; shelf membership                                         |
| Reading history API     | `modules/reading-history/**`                                               | Join **reading_work**                                                   |
| LLM / TTS admin + logs  | `features/admin/ai-*`, `tts-*`                                             | Ops — not learner                                                       |
| Admin catalog ops       | `features/admin/article-*` → **`work-*`**                                  | EPUB upload + publish **ReadingWork**                                   |

### 2.2 REFACTOR → Phase 3 migration

| Area              | Current (legacy)                         | Target (ADR-001)                                      |
| ----------------- | ---------------------------------------- | ----------------------------------------------------- |
| Content root      | `article` table, single `body`           | `reading_work` + `reading_part`                       |
| Derived audio     | `article_audio`                          | `content_asset` (`audio_us` / `audio_uk`)             |
| Progress / shelf  | `reading_progress`                       | `reading_state`                                       |
| Discover API      | `GET /api/articles`                      | `GET /api/catalog/works`                              |
| Reader API        | `/api/reader/articles/:articleId`        | `/api/reader/works/:workId`                           |
| Admin API         | `/api/admin/articles`                    | `/api/admin/works`                                    |
| Shared types      | `@gloaming/shared/api/articles`          | `@gloaming/shared/api/works`                          |
| Wire mock → API   | discover, shelf, history, reader         | Target Work/State APIs                                |
| Short-article era | [`docs/archive/feature-short-article-library-v1.md`](../archive/feature-short-article-library-v1.md) | **Archived** — not product |

### 2.3 DELETE in Phase 3 (do not postpone)

| Legacy concept              | Why delete                                              |
| --------------------------- | ------------------------------------------------------- |
| `Article` / `article` table | Wrong domain root                                       |
| `article_audio`             | Replaced by **ContentAsset**                            |
| `reading_progress`          | Replaced by **reading_state**                           |
| `ArticleLevel`, `seriesId`  | Short-article / course identity                         |
| `ARTICLE_BODY_MAX_WORDS`    | 300-word product cap                                    |
| Article API routes          | No alias — target routes only                           |

### 2.4 REMOVED (already deleted from codebase)

| Area                         | Why it conflicted           |
| ---------------------------- | --------------------------- |
| **Practice system**          | Quiz loop / course identity |
| **Review system**            | Daily SRS-shaped queue      |
| **Learner Library page**     | → **发现**                  |
| **Learner learn-room UI**    | → **Reader**                |
| **Progress / 成长 page**     | → **阅读历史**              |
| **Dashboard home route**     | → **我的书架**              |

No separate vocabulary/SRS product. Lookup “vocabulary card” is assist **format** only.

### 2.5 Missing vs V1 target (Phase 3 work)

| V1 must                         | Current state (2026-08-24)                                      |
| ------------------------------- | --------------------------------------------------------------- |
| Admin EPUB upload + processing  | **Absent** — paste CMS on legacy `article`                      |
| ReadingWork + ReadingPart schema | **Absent** — `article` only                                    |
| Chapter / part reader         | **Absent** — single `body`                                      |
| ContentAsset (origin + TTS)   | **Partial** — `article_audio` only                              |
| User import                     | **Absent** (Phase 1b — correct to defer)                        |
| Learner UI wired to Work APIs | **Mock** — legacy article fixtures                              |

TTS, translation, assist exist but bind to **Article** — Phase 3 rebinding to **Part**.

---

## 3. Migration plan

Practice/Review **removal is done**. **Phase 3** = Article → ReadingWork code migration.

### 3.1 Domain decision — closed

**Open Question (Article vs document) is closed.**

**Decision:** ADR-001 accepted — **ReadingWork + ReadingPart + ReadingState + ContentAsset**. No Article extension. No compatibility layer.

### 3.2 Phase 3 execution order

| Step | Layer            | Intent                                                |
| ---- | ---------------- | ----------------------------------------------------- |
| 1    | `packages/db`    | New schema; drop `article`, `article_audio`, `reading_progress` |
| 2    | `packages/shared`| DTOs / Zod — `works`, `reader`, retire `articles`     |
| 3    | `apps/backend`   | `modules/works/**`; rebind assist/translate/tts       |
| 4    | `apps/web`       | Routes `/read/[workId]`; features/admin/work-*        |
| 5    | Tests            | Functional specs on Work model                        |

Each step: typecheck → test → build for touched scope.

### 3.3 What not to do

- Do not rebuild Practice/Review.
- Do not add `article` alias routes or Article \| Work union types.
- Do not extend `article` for EPUB — migrate schema.
- Do not treat Short Article Library as product ([`docs/archive/`](../archive/README.md)).

---

## 4. Engineering notes

### 4.1 Content model — **Accepted (ADR-001)**

One **ReadingWork** with ordered **ReadingPart** rows. Short text = 1 part (`kind=body`). EPUB = N parts (`kind=chapter`). Future sources = new `origin_kind` + processors — same tables.

See [`engineering-vocabulary.md`](./engineering-vocabulary.md) for product ↔ engineering map.

### 4.2 Module priority (Phase 3)

| Keep investing                         | Migrate in Phase 3                         | Gone forever        |
| -------------------------------------- | ------------------------------------------ | ------------------- |
| `features/reader/**`, assist, translate, tts | `article*` → `works` / `content_asset` | practice, review    |
| Auth, admin LLM/TTS config             | Admin EPUB upload pipeline                 | Learn* modules      |
| `conversation` (subject → reading_work)| Shelf/reader/history wire-up               | Article as SSOT     |

---

## 5. Revision log

| Date       | Change                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| 2026-08-24 | ADR-001 alignment; Open Question closed; Phase 3 order; DELETE list.   |
| 2026-08-23 | Frontend learner cleanup; library/progress removed.                    |
| 2026-08-20 | Practice/Review removed; initial reading-environment audit.            |
