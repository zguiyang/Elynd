# Engineering vocabulary

Gloaming uses **product language** in UX and **engineering language** in code/APIs. This doc maps the two and records MVP 1a entity names.

## Product surfaces (user-facing)

| Surface             | Route / API                                                | Meaning                                          |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| **Discover**        | `/discover`, `GET /api/articles`                           | Browse published content; pick what to read next |
| **Shelf**           | `/my-shelf`, `GET /api/shelf`                              | Continue reading + progress-backed items         |
| **Reader**          | `/read/[articleId]`, `GET /api/reader/articles/:articleId` | Immersive reading session                        |
| **Reading History** | `/reading-history`, `GET /api/reading-history`             | Calm overview of reading activity over time      |

UI copy may still say **书 / Book / 封面 / 章节** — that is intentional user metaphor, not the engineering entity name.

## Engineering entities (MVP 1a)

| Entity              | Table / type                                                               | Notes                                                                                                      |
| ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Article**         | `article`, `@gloaming/shared/api/articles`                                 | Single content unit for MVP 1a. Admin CMS uses **Article** naming (`AdminArticle`, `/api/admin/articles`). |
| **ReadingProgress** | `reading_progress`, `ReadingProgress` in `@gloaming/shared/api/reader`     | Per user × article position and completion                                                                 |
| **ReadingDay**      | `reading_day`, `ReadingHistory*` in `@gloaming/shared/api/reading-history` | One calendar day (Asia/Shanghai) with recorded reading activity                                            |

## Shared API contracts (cross-app)

| Module                    | Key types                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `api/shelf`               | `ShelfData`, `ShelfItem`                                                                  |
| `api/reader`              | `ReaderSessionData`, `ReaderItemSummary`, `ReaderAudioTrack`, `UpdateReadingProgressBody` |
| `api/reading-history`     | `ReadingHistoryData`, `ReadingHistorySummary`, `ReadingHistoryCompletion`                 |
| `api/articles` (Discover) | `DiscoverListData`, `DiscoverListQuery` — public published list only                      |

## Retired names (do not reintroduce)

- `Learn*`, `/api/learn/*` — old Learning Platform module
- `Progress*`, `/api/progress` — old progress dashboard semantics
- `learner_day`, `learningDays` — replaced by `reading_day`, `readingDays`
- `CatalogArticle*` — user Discover DTOs; use `Discover*` instead (Admin **Article** unchanged)

## Phase 1b (future — not implemented)

MVP 1a **article** will evolve into a **work + part** content model (e.g. book + chapters). Do not implement work/part tables or routes until Phase 1b is scoped and migrated.
