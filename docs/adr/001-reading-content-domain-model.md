# ADR-001: Reading Content Domain Model

**Status:** Accepted / Frozen  
**Date:** 2026-08-24  
**Scope:** Core content domain — replaces the legacy `Article` model

Related: [`engineering-vocabulary.md`](../product/engineering-vocabulary.md) · [`content-strategy.md`](../product/content-strategy.md)

---

## Context

Gloaming moved from an **AI-generated short-article learning platform** to an **AI Native Language Reading Environment**. The codebase still centers on `Article` (300-word cap, single `body`, level/series metadata), which conflicts with product docs (document-first, EPUB chapters, multiple future sources).

There are **no production users** and **no historical data compatibility** requirement. The team chose correctness over incremental extension of `Article`.

---

## Decision

1. **Retire `Article`** as the content root — no extension, no alias, no compatibility layer.
2. Adopt **`ReadingWork` + `ReadingPart`** as the only reading content structure.
3. Adopt **`ReadingState`** for shelf membership and reading position (replaces `reading_progress`).
4. Adopt **`ContentAsset`** for source files and derived resources (replaces `article_audio`).
5. Keep **`Conversation`**; change `subject_type` from `article` to `reading_work`.
6. Treat **`Shelf`** as a **read-model aggregate** over `reading_state` — no `shelf_entry` table in MVP.
7. **MVP primary supply:** `admin_epub` (Admin EPUB upload → processing → publish).
8. **`admin_text`:** internal fallback only (dev/test/seed) — **not** a product capability.

---

## Domain entities

### ReadingWork (`reading_work`)

**User concept:** A book / piece of reading content.  
**Responsibility:** Metadata, source, publish status, visibility — **no body text**.

**Lifecycle:** `draft` → `processing` → `published` | `failed`.

**Key fields:** `id`, `title`, `description`, `language`, `status`, `visibility`, `owner_user_id` (null = official catalog), `origin_kind`, `origin_meta`, `tags`, `cover_asset_id`, `published_at`, timestamps. Channel providers live on the `source` dimension via `reading_work_source` (not a free-text note on the work).

**Forbidden on Work:** `level`, `seriesId`, `estimatedMinutes`, `body`.

### ReadingPart (`reading_part`)

**User concept:** Chapter / reading unit.  
**Responsibility:** Ordered readable text — SSOT for Reader, TTS, Translate, Assist context.

**Relationship:** N parts per Work (`work_id` + `sort_order` UNIQUE).

**Key fields:** `id`, `work_id`, `sort_order`, `kind`, `title`, `body`, `meta`.

**MVP `kind`:** `chapter`, `body`. **Reserved:** `section`, `segment`.

### ReadingState (`reading_state`)

**User concept:** My reading status on a book.  
**Responsibility:** Shelf membership + current position (replaces `reading_progress`).

**Lifecycle:** absent → added → `in_progress` → `completed`.

**Key fields:** `id`, `user_id`, `work_id`, `current_part_id`, `anchor_kind`, `anchor_value`, `status`, `added_at`, `last_read_at`, `completed_at`.

**Note:** `progressRatio` is **computed** for UI — not persisted.

### ContentAsset (`content_asset`)

**Responsibility:** Unified storage for EPUB originals, covers, TTS audio, future derivatives.

**Key fields:** `id`, `work_id?`, `part_id?`, `kind`, `storage_key`, `mime_type`, `content_hash`, `meta`, `status`, timestamps.

**MVP `kind`:** `origin_file`, `audio_us`, `audio_uk`.

### Conversation (unchanged shape)

**Change only:** `subject_type = 'reading_work'`, `subject_id = work.id`.

**Assist context:** `workId` + `partId` + `selection`.

### Shelf (read model)

**Not a database table.** MVP implementation:

```text
Shelf = reading_state JOIN reading_work (published / accessible)
```

**Add to shelf:** create or ensure a `reading_state` row.

---

## Migration boundary

### Implement in MVP (Phase 3)

| Area                      | Scope                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Schema                    | `reading_work`, `reading_part`, `reading_state`, `content_asset`; drop article tables |
| Admin supply              | EPUB upload → processing → parts → publish                                            |
| Discover / Shelf / Reader | Work + Part + State                                                                   |
| Assist / Translate / TTS  | Part-scoped text                                                                      |
| `admin_text` fallback     | 1 work + 1 part (`kind=body`) for dev/test only                                       |

### Reserved, not implemented in MVP

| Area                            | Reserved via                                                |
| ------------------------------- | ----------------------------------------------------------- |
| User EPUB/PDF upload            | `owner_user_id`, `visibility=private`, `origin_kind=user_*` |
| Web / video / podcast           | `origin_kind`, `part.kind`, `part.meta`                     |
| `shelf_entry` table             | Can use `reading_state.added_at` until needed               |
| Vocabulary product / RAG tables | Conversation message IDs as future pointers                 |

---

## Alternatives considered

| Option                                          | Rejected because                                      |
| ----------------------------------------------- | ----------------------------------------------------- |
| Extend `article` with long body / JSON chapters | Wrong semantics; derived resources stay article-bound |
| Parallel `document` + keep `article`            | Two reading types — violates content-strategy         |
| Flat single-table content                       | No chapter boundary for TTS/progress/assist           |
| Separate `shelf_entry` + `reading_progress`     | MVP over-design; state row suffices                   |
| Keep `/api/articles` alias                      | Perpetuates dual model                                |

---

## Consequences

**Positive**

- One content model for EPUB, future imports, and internal `admin_text` seed.
- Clear boundaries: Work (catalog/shelf/thread) vs Part (read/TTS/translate).
- Phase 3 migration path: db → shared → backend → frontend.

**Negative**

- Full-stack breaking change (acceptable — no users).
- Admin ops shifts from paste-form identity to EPUB pipeline.

**Implementation order (Phase 3):** `packages/db` → `packages/shared` → `apps/backend` → `apps/web` → tests.

---

## Revision log

| Date       | Change                                           |
| ---------- | ------------------------------------------------ |
| 2026-08-24 | Initial ADR — frozen at Phase 1 domain alignment |
