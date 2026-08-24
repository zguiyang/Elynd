# Gloaming Book Detail Design Context

**Purpose:** Fact pack for Book Detail UI design.  
**Scope:** Research + shipped-route reference.  
**Date:** 2026-08-20 (routes updated **2026-08-23**).

> **Superseded sections:** Any journey referencing `/dashboard`, `/library`, `/learn/:id`, or `features/library/**` / `features/learn/**` describes **archived** code (removed). Current learner routes are in **Current shipped routes** below.

**Legend (status tags used below):**

| Tag               | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| **Locked**        | Product decision in `docs/product/` (do not invent against it)   |
| **Existing Code** | Shipped in repo today                                            |
| **Future**        | Documented intent / Phase 1b+ / migration direction, not shipped |
| **Open Question** | Not decided; design must not silently assume                     |

---

## Product Role

### Book Detail Role (derived from docs — not a locked module name)

**Fact:** MVP 1 module inventory (`mvp-1-modules.md`) does **not** list a “Book Detail” surface. Learner destinations are exactly: **我的书架** | **发现** | **阅读历史**, plus **Reader** via content.

**Proposed page role (for design input) — mapped to Locked responsibilities:**

Book Detail Role:

- **Content introduction / choice surface** — **Locked** under **发现**: “show enough metadata to choose a text”; primary story is **add to shelf**, open-to-read allowed (`mvp-1-modules.md` §4.4).
- **Reading entry** — **Locked**: open path from Discover or Shelf → Reader (`prototype-flows.md` §3–4). Today that entry is **direct**; a dedicated Detail hop is **Open Question**.
- **User decision page** — **Locked** intent for Discover (choose official text); Detail would concentrate metadata + CTA if inserted.
- **Reading state recovery page** — **Not** Book Detail’s home. **Locked:** resume / **继续阅读** belongs to **我的书架** (`mvp-1-modules.md` §4.3; `prototype-flows.md` Confirmed). Detail may _show_ progress if the user arrives from catalog while already reading — **Open Question** for UX, not for where “daily resume” lives.

**What Book Detail is not (Locked anti-identity):**

- Not a chat / AI home (`product-principles.md` §4; AI lives in Reader).
- Not a lesson / Practice / Review gate (`mvp-scope.md` §3; practice/review **REMOVED**).
- Not required upload / import chrome in MVP 1 (Phase **1b**).

**Canonical loop (Locked):**

```text
Choose authentic English → Open and read → Unstick with contextual AI → Keep reading
```

Returning users’ first action: **continue the unfinished text** on **我的书架**, not study check-in (`product-vision.md` §2).

---

## User Journey

### Locked target journey (MVP 1 / Phase 1a)

```text
发现 (Discover)
  → 加入书架 → 我的书架 → open → Reader
  → 或 打开阅读 → Reader
我的书架
  → 继续阅读 / open → Reader
```

Sources: `mvp-1-modules.md` §3–6, `prototype-flows.md` §3–4.

### Current shipped routes (2026-08-24)

**Phase 3A:** `/read/[workId]`, `/discover/[workId]`.

```text
我的书架 (/my-shelf)              → continue / grid → /read/[workId]
发现 (/discover)                  → card → /discover/[workId] or /read/[workId]
书籍详情 (/discover/[workId])     → CTA → /read/[workId]
阅读历史 (/reading-history)       → completion row → /read/[workId]
Reader (/read/[workId])           → renders current ReadingPart body
```

Implementation: `features/shelf/**`, `features/discover/**`, `features/book-detail/**`, `features/history/**`, `features/reader/**`.

### Archived journey (**superseded** — do not wire against)

```text
今日 (/dashboard)          ← REMOVED
  → Continue / card → /learn/:articleId (Reader)
  → 打开图书馆 → /library

图书馆 (/library)          ← REMOVED
  → VolumeCard “开始阅读” → /learn/:articleId (Reader)

成长 (/progress)           ← REMOVED (replaced by /reading-history)
```

**Archived “Current Journey” (pre-2026-08-23):**

```text
Discover (图书馆 /library)
  ↓
(no Book Detail page)
  ↓
Reader (/learn/:articleId)
```

Alternate:

```text
Shelf-home (今日 /dashboard)
  ↓
Reader (/learn/:articleId)
```

### Card → click → destination (**Archived UI — pre Work routes**)

| Surface                        | Card shows                                                                                                        | Click goes to | Detail entry? |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------- | ------------- |
| Library `VolumeCard`           | Title; level (简单/中等/稍难); up to 2 themes; estimated minutes; tinted “cover” (no real image); CTA「开始阅读」 | `/learn/:id`  | **No**        |
| Dashboard continue / recommend | Title; level · minutes · theme; progress % if > 0                                                                 | `/learn/:id`  | **No**        |

### Proposed journey under discussion (**Open Question**)

```text
Discover
  ↓
Book Detail   ← not in locked IA; would be a new hop
  ↓
Reader
```

Design must treat this as a **possible** insert, not as Locked SSOT, until product updates `mvp-1-modules.md` / `prototype-flows.md`.

---

## Data Model

**SSOT:** ADR-001 [`../adr/001-reading-content-domain-model.md`](../adr/001-reading-content-domain-model.md) · [`engineering-vocabulary.md`](./engineering-vocabulary.md)

Do **not** use legacy **Article** fields as design authority.

### Target domain model (**Accepted — ADR-001**)

```text
ReadingWork {                     # reading_work — catalog / shelf / AI thread root
  id, title, description, language,
  status:           draft | processing | published | failed | archived
  visibility:       catalog | private
  owner_user_id:    null = official catalog
  origin_kind:      admin_epub | admin_text | (future user_* …)
  origin_meta, tags, source_note, cover_asset_id,
  published_at, created_at, updated_at
  # No body, level, seriesId, estimatedMinutes
}

ReadingPart {                     # reading_part — Reader / TTS / Assist text boundary
  id, work_id, sort_order,
  kind:             chapter | body | (section | segment reserved)
  title, body, meta
}

ReadingState {                    # reading_state — shelf + position (replaces reading_progress)
  id, user_id, work_id,
  current_part_id, anchor_kind, anchor_value,
  status, added_at, last_read_at, completed_at
  # progressRatio = computed UI only
}

ContentAsset {                    # content_asset — origin EPUB, TTS, cover, …
  id, work_id?, part_id?, kind, storage_key, mime_type,
  content_hash, meta, status, …
}

Conversation {
  subject_type:     reading_work
  subject_id:       work.id
  # Assist calls also pass partId + selection
}

Shelf = read model: reading_state JOIN reading_work (no shelf_entry table in MVP)
```

**Reader session:** work metadata + parts[] + current part body + ReadingState + part-level `audioAvailable`.

### Legacy Article model — **removed in Phase 3A**

Do **not** design new UI against these (tables dropped in migration `0013`):

```text
article { title, body, level, themes, seriesId, … }   ← DELETED
reading_progress { articleId, progressRatio }         ← DELETED
article_audio { articleId, role, … }                  ← DELETED
```

Short-article era (`ARTICLE_BODY_MAX_WORDS`, level bands) is **archived product** — see [`docs/archive/feature-short-article-library-v1.md`](../archive/feature-short-article-library-v1.md).

**One reading type:** ReadingWork — not Article plus a separate Book app.

---

## Existing Components

### Routes & features

**Current (Phase 3A):** `features/shelf/**`, `discover/**`, `book-detail/**`, `reader/**`, `history/**`; admin **`works-*`**.

| Area          | Path                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| Shelf         | `features/shelf/**` → `/my-shelf`                                      |
| Discover      | `features/discover/**` → `/discover` (lists **ReadingWork**)           |
| Book detail   | `features/book-detail/**` → `/discover/[workId]`                       |
| Reader        | `features/reader/**` → `/read/[workId]` (renders **ReadingPart**)      |
| History       | `features/history/**` → `/reading-history` (completions by **workId**) |
| Admin catalog | `features/admin/works-*`; EPUB upload = Phase 3B                       |

**Removed (do not reference):** `features/dashboard/**`, `features/library/**`, `features/learn/**`, `/progress`, `/dashboard`.

### Book Detail page

**Exists:** `features/book-detail/**` at `/discover/[workId]`. Metadata for **ReadingWork** before Reader entry.

### Reusable UI atoms (**Existing Code**)

shadcn under `apps/web/components/ui/` (button, card, empty, skeleton, tabs, sheet, badge, …). Feature cards are mostly custom Tailwind on `Link`, not a dedicated BookCard package.

Cover pattern: `coverTintForVolume(themes, title)` — paper/muted washes + title text; **no image asset pipeline**.

---

## Design System

**SSOT:** repo root [`DESIGN.md`](../../DESIGN.md) (implement via `apps/web/app/globals.css`).  
**Not SSOT for app UI:** `prd/落地页原型/DESIGN.md` (landing prototype palette — different Material-style tokens; do not mix into Book Detail without an explicit decision).

### Character (**Locked** visual)

Calm editorial product shell: warm paper, single ember accent, **light theme only**, quiet motion. Feel: “It’s quiet here. I can read a little.”

### Colors (**Locked** in DESIGN.md)

| Token      | Hex       | Role                          |
| ---------- | --------- | ----------------------------- |
| Canvas     | `#FAF9F6` | Page background               |
| Paper      | `#F3EEE2` | Warm panels                   |
| Sidebar    | `#FCFBF8` | Sidebar wash                  |
| Ink        | `#1C1917` | Primary text                  |
| Surface    | `#FFFFFF` | Cards / forms                 |
| Brand      | `#C2410C` | Primary CTA / scarce emphasis |
| Brand soft | `#FFF7ED` | Small accent washes only      |
| Brand deep | `#9A3412` | Hover / deeper emphasis       |
| Muted      | `#57534E` | Secondary copy                |
| Border     | `#E7E5E4` | Hairlines                     |

### Typography

- UI / body / labels: **Source Sans 3** + Noto Sans SC (never Inter).
- Titles / book titles: **Source Serif 4** + Noto Serif SC.
- Exact px type scale: **not frozen**.

### Shapes / elevation

- Control radius ~`0.8rem`; large panels ~`1.75rem`; in-app primary CTA `rounded-xl` (not pills); auth CTA may be pill.
- Hierarchy via tonal layers; soft short shadow only (`shadow-card` ≈ soft ink wash). Prefer hairline rings over heavy shadows.
- Spacing scale: **not frozen** — prefer generous breathing room.

### Layout notes from DESIGN.md

- Collapse multi-column below ~768px.
- System UI language: **Chinese** until i18n is an explicit decision.
- Study Apple Books / TextStack / Readest for **interaction**, not their visual systems.

---

## Competitor Insights

**Reference:** [TextStack](https://github.com/mrviduus/textstack) — listed in `product-vision.md` §8 (learn AI-in-book stance, UI tone, content organization; **do not copy** SRS / learning stats / kitchen-sink panels).

### What TextStack’s Book Detail includes (observed from source)

`BookDetailPage` + `BookDetailHero`:

- Cover, title, authors, description (“what is this about”)
- Meta: chapter count, language, genres; Read / Continue CTA into first or last-progress chapter
- Chapter list (TOC) with word counts; expand-all
- Add to library / collection; offline download; podcast player when present
- SEO blocks: themes, relevance, FAQ, similar books, more by author, other editions
- Separate `UserBookDetailPage` for uploads (processing banners, delete, etc.)

`BookDetail` type fields include: slug, description, coverPath, chapters[], authors[], genres[], SEO fields, ragStatus, podcast, etc.

### Keep (worth studying for Gloaming)

Keep:

- Calm **hero of the work**: cover (or placeholder) + title + short description before reading.
- Clear **primary reading CTA** that switches Start → Continue when progress exists.
- **“Add to shelf”** as a first-class action (aligns with Locked Discover primary story).
- **TOC / chapter list** as a pattern **when** Gloaming has chapters (Phase 1b / long-form) — not forced onto today’s 300-word `article`.
- Enough metadata to **choose** a text without opening the full body.

### Avoid (conflicts with Gloaming)

Avoid:

- **SRS / vocab queue** as part of detail or adjacent product identity (explicit vision anti-copy).
- Detail page as **SEO / FAQ / similar-books marketing hub** becoming the product center.
- **Podcast / RAG index / multi-edition bookstore** chrome as MVP 1 defaults.
- **Upload processing theater** on learner Book Detail in MVP 1 (import is 1b).
- Making **AI / “Ask this book”** the hero of the detail page (companion stays in Reader).
- Kitchen-sink control panels and learning-stats dashboards.

---

## Required UI States

Suggestions grounded in Locked roles + Existing progress model. **Not** a shipped state machine.

### Required States

1. **New Book (never opened)**
   - **Why:** Discover choice + entry; user has no progress.
   - **Show:** Enough metadata to decide; primary CTA open / start; add-to-shelf (**Locked** primary Discover story).
   - **Data today:** article fields; progress absent until Reader opens (opening creates progress — Existing).

2. **Returning Reader (in_progress)**
   - **Why:** User may re-enter from Discover/Detail with existing %. Daily resume still belongs on 我的书架 (**Locked**).
   - **Show:** Progress hint; CTA「继续阅读」; optional last-read time.
   - **Data:** `progressRatio`, `status`, `lastReadAt`.

3. **Reading Completed**
   - **Why:** `status: completed` exists in schema.
   - **Show:** Completed affordance; reopen / read again without quiz gate.
   - **Avoid:** “finish lesson → practice” patterns (**REMOVED**).

4. **On shelf vs not on shelf** (**Future** membership model)
   - **Why:** Locked Discover story is add-to-shelf; code today has **no** shelf membership — catalog = all published.
   - **Show (when built):** Add vs Already on shelf; source label `官方` (and later `用户`).

5. **Mobile layout**
   - **Why:** DESIGN.md collapses multi-column &lt;768px; cards already 2-col on small screens.
   - **Show:** Single-column detail; CTA reachable without desktop-only chrome.

6. **Loading / Error / Not found**
   - **Why:** Reader and Library already handle pending/error/empty patterns.
   - **Show:** Calm empty/error; path back to 发现 / 我的书架 — no AI upsell as empty-state hero (`design-guardrails.md`).

7. **No audio / AI unavailable** (**Locked** degrade)
   - **Why:** Document must still open and read if AI/TTS off.
   - **Show on Detail:** Do **not** require audio/AI badges as blockers; optional quiet availability hints only if useful.

---

## Open Questions

1. **Is Book Detail a new MVP 1 module?**  
   Locked IA has no Detail destination. Inserting Discover → Detail → Reader needs an explicit product lock (update `mvp-1-modules.md` / `prototype-flows.md`) vs keeping metadata on Discover cards only.

2. **From Shelf, does open go Detail or straight to Reader?**  
   Locked flows say Shelf → Reader. Detail-from-shelf is undecided.

3. **Content atom for Detail design mock:** short `article` (Existing) vs long-form book with TOC (Future 1b)?  
   Designing TOC/author/cover as required MVP 1 fields may overfit Future schema.

4. **Shelf membership data model** — when / how before Detail CTAs can show “已在书架”?

5. **Author, cover image, blurb fields** — add to catalog CMS for 1a, or keep tinted title covers?

6. **Schema fork** (`feature-audit.md` §4.1): extend `article` vs new `document` + parts — Ask before migrate; Detail copy should not invent a second reading type.

7. **Nav rename timing** (今日→我的书架, 图书馆→发现) vs designing Detail against new names.

8. **Landing prototype tokens** (`prd/落地页原型/`) vs root `DESIGN.md` — which applies if marketing and app diverge? App product UI → **DESIGN.md**.

---

## Recommendations for Stitch Design

Constraints for any Stitch / prototype pass (facts + Locked rules — still **not** a layout):

1. **Treat Book Detail as a calm book-introduction + decision + entry surface**, secondary to Reader and to 我的书架 resume. Do not make it a study dashboard or AI showcase.

2. **Primary actions to prioritize conceptually:**
   - Add to **我的书架** (Discover primary story)
   - Open / Continue → **Reader**  
     Resume-of-the-day remains owned by **我的书架**.

3. **Metadata budget (Existing-safe):** title, level, themes, estimated minutes, sourceNote (provenance), progress if any.  
   Mark author / real cover / TOC / description blurb as **Future or Open** unless product adds fields.

4. **AI Companion / TTS on Detail:**

   **Should Book Detail expose AI?**

   **No** (as a primary surface).

   **Reason:** Locked: AI companion, translation, and TTS are **Reader** modules (`mvp-1-modules.md` §4.7–4.9). Principles: AI appears when needed on **this passage**, then recedes; AI must not be home/hero. Detail may at most hint that help exists inside reading — never chat CTA, never “start with AI summary” as the main path (`design-guardrails.md` §2.5).

5. **Visual system:** root `DESIGN.md` only — paper/canvas/ember, serif titles, sans UI, light theme, restrained radius/shadow. Do not import TextStack visuals or landing-prototype Material tokens.

6. **Competitor borrow:** TextStack’s hero + Start/Continue + shelf add + (later) TOC. Reject SRS, FAQ/SEO theater, podcast/RAG as MVP 1 identity.

7. **States to cover in prototypes:** New / In progress / Completed / Loading-Error / Mobile; shelf membership only if product locks it into the mock.

8. **Anti-drift checklist before accepting a Detail prototype:**
   - Does this help the user **choose and enter** a real text?
   - Does it create a study task or AI chat home? → cut
   - Does daily resume still feel owned by 我的书架?

---

## Source index

| Kind                         | Path                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Vision / principles          | `docs/product/product-vision.md`, `product-principles.md`                                                   |
| MVP capabilities             | `docs/product/mvp-scope.md`                                                                                 |
| Module IA (Locked)           | `docs/product/mvp-1-modules.md`                                                                             |
| Nav journeys (Locked)        | `docs/product/prototype-flows.md`                                                                           |
| Content / fields intent      | `docs/product/content-strategy.md`                                                                          |
| Code vs product              | `docs/product/feature-audit.md`                                                                             |
| Guardrails                   | `docs/product/design-guardrails.md`                                                                         |
| Roadmap                      | `docs/product/roadmap.md`                                                                                   |
| Visual SSOT                  | `DESIGN.md`, `apps/web/app/globals.css`                                                                     |
| Domain SSOT                  | `docs/adr/001-reading-content-domain-model.md`, `docs/product/engineering-vocabulary.md`                    |
| Schema (target)              | `packages/db/src/schema.ts` — **Phase 3:** `reading_work`, `reading_part`, `reading_state`, `content_asset` |
| Shared DTOs (target)         | `@gloaming/shared/api/works`, `reader`, `shelf` — **Phase 3** retires `api/articles`                        |
| Shelf / Discover / Reader UI | `apps/web/features/shelf/**`, `discover/**`, `book-detail/**`, `reader/**`                                  |
| TextStack reference          | https://github.com/mrviduus/textstack (`BookDetailPage`, `BookDetailHero`, `BookDetail` type)               |
