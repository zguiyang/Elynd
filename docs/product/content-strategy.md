# Elynd Content Strategy (MVP)

SSOT for **what content we ship**, **how we process it**, and **how it enters the product**—before the Library / admin module is built.

Related: [`mvp-scope.md`](./mvp-scope.md) · [`product-vision.md`](./product-vision.md) · [`learning-philosophy.md`](./learning-philosophy.md) · [`prototype-flows.md`](./prototype-flows.md) · [`success-metrics.md`](./success-metrics.md)

**Language:** Product docs are English. User-facing copy may be Chinese.

---

## 1. Purpose of content in MVP

Content exists so we can validate the product bet:

1. Can a learner **actually learn** through this reading/listening loop?
2. Will **we** (builders) want to open and use it regularly?
3. Will **anyone else** willingly use it?

Content is **not** a corpus-building project. Prefer **few polished pieces** over many mediocre ones. Expand types and volume only after the loop proves itself.

---

## 2. Scope decisions (locked 2026-08-05)

| Decision                                 | MVP stance                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supply model                             | **Fixed curated library**—team-owned or clearly licensed texts                                                                                   |
| Scraping / scheduled crawl of public web | **Out** of MVP (revisit only with whitelist + legal review in a later phase)                                                                     |
| Full ebook / EPUB reader in-app          | **Out** of MVP                                                                                                                                   |
| User import (ebooks, links)              | **Defer** until curated loop works ([`mvp-scope.md`](./mvp-scope.md))                                                                            |
| Memes / joke-pack / “梗” pieces          | **Out** of first batch; may return later as a small spice, not a pillar                                                                          |
| Primary genres                           | **Short narrative / modernized fable** + **a little situational** content                                                                        |
| Quantity                                 | **Lean**—start with a **validation set of ~5** articles, not a two-week flood                                                                    |
| Learning unit                            | **One short article = one unit** (no chapter tree / syllabus cut in MVP)                                                                         |
| Admin tooling                            | **Admin-only CMS** (draft → publish → unpublish); never exposed to learners                                                                      |
| When to write bodies                     | When implementing Library / content module—not during early platform work                                                                        |
| AI role on supply                        | AI may later **assist enrichment** (draft gloss, practice items); it does **not** invent a course or replace human selection of interesting text |
| AI role at read time                     | In-text explain / optional practice from **this** article ([`mvp-scope.md`](./mvp-scope.md) §6)                                                  |

---

## 3. Genre mix (first validation set)

| Genre                                            | Role                                                    | Share of first set |
| ------------------------------------------------ | ------------------------------------------------------- | ------------------ |
| Short narrative / modernized fable               | Main “want to finish” fuel                              | ~4 of 5            |
| Situational (dialogue embedded in a short story) | Light real-life flavor without textbook role-play packs | ~1 of 5            |
| Memes / pure joke bits                           | —                                                       | **0** for now      |
| Raw news / novel excerpts / full ebooks          | —                                                       | **Not** first set  |

**Situational rule:** Prefer a **short story that contains** natural dialogue (e.g. trying on a jacket) over a pure “mall / restaurant dialogue drill.” Avoid course identity.

**Tone:** Adult-friendly. If using fable or fairy-tale bones, **rewrite voice** so it does not feel like a children’s reader.

---

## 4. Article shape (processing contract)

Each published item is one **Article** aimed at a **5–20 minute** session.

### 4.1 Suggested length

About **150–300 words** for the first validation set (upper bound ~400 if needed). Whole piece should be readable in one sitting.

### 4.2 Minimum fields (for later CMS / API)

| Field              | Required    | Notes                                                     |
| ------------------ | ----------- | --------------------------------------------------------- |
| `title`            | Yes         | English working title OK in MVP                           |
| `body`             | Yes         | Full English text                                         |
| `level`            | Yes         | Coarse bands, e.g. `easy` / `mid` / `stretch`             |
| `themes` / tags    | Yes         | e.g. story, fable, situational                            |
| `estimatedMinutes` | Recommended | ~5–15                                                     |
| `sourceNote`       | Yes (admin) | e.g. original, rewrite of public-domain motif, licensed   |
| `status`           | Yes         | `draft` \| `published` (learners see `published` only)    |
| `audioUrl`         | Optional    | TTS or recorded; can ship after text loop                 |
| Preloaded glossary | Optional    | Reading-time AI first; static gloss as degrade path later |

### 4.3 How we “cut” content

MVP: **no multi-chapter cutting.**  
One article → Library / Today → Learning Room → optional Practice on **same** `articleId` → expressions may feed Review ([`prototype-flows.md`](./prototype-flows.md)).

Ebooks (when used later) are a **source for selecting/rewriting short pieces**, not an in-app book shelf.

---

## 5. End-to-end flows

### 5.1 Learner flow (product)

```text
Discover (Library / Today card)
  → Learning Room (read + optional listen + on-demand assist)
  → optional Practice (1–3 checks on that text)
  → Review / Progress later from shell
```

Content strategy only supplies **publishable articles**. It does not invent a separate “AI-generated learning path.”

### 5.2 Ops / admin flow (future CMS)

```text
Select or write/rewrite short text (human)
  → Enter draft in admin UI (title, body, level, tags, sourceNote)
  → Optional enrich later (audio, gloss draft, practice draft)
  → Human review → status = published
  → Appears in Library / can be “current” article
  → Unpublish if needed (hidden from learners)
```

Admin UI is **operators only**. Learners never create or edit the catalog in MVP.

### 5.3 What we explicitly do not run in MVP

```text
Crawl public web on a schedule → auto-AI “course” → ship to users
```

That path conflicts with interest control, copyright, and product identity (course / content factory).

---

## 6. First validation set (titles locked; bodies deferred)

**Do not collect or write full texts until the content/Library module is in active development.** Titles below are the agreed shortlist for the first ~5 pieces.

Recommended set:

| #   | Working title                | Genre                | Level (intent) |
| --- | ---------------------------- | -------------------- | -------------- |
| 1   | The Wrong Umbrella           | Short narrative      | easy           |
| 2   | Two Minutes Late             | Short narrative      | easy           |
| 3   | The Neighbor’s Piano         | Short narrative      | easy           |
| 4   | Fox and the App Notification | Modernized fable     | easy           |
| 5   | Trying On a Jacket           | Situational-in-story | easy           |

Parked for later (not first set): humor/meme ideas, heavier workplace pieces, birthday-dinner situational, more fables—only after validation.

---

## 7. Quality bar before publish

A piece is ready only if:

1. An adult might **want to finish** it (interest)
2. Most of it is **understandable** at the labeled level (i+1 / high coverage intent)
3. It fits a **short session** without a syllabus wall
4. **Source/rights** are clear in `sourceNote`
5. It does not push Elynd toward **course pack**, **vocab list**, or **chatbot** identity

---

## 8. Phase note

| When                            | Content work                                                      |
| ------------------------------- | ----------------------------------------------------------------- |
| Now (docs only)                 | This strategy SSOT                                                |
| P1 Library / Learning Room      | Seed the validation set; admin draft/publish path                 |
| After loop metrics look healthy | More articles; optional humor; licensing partners; ingest tooling |
| Later                           | User import; careful licensed feeds—not blind scrape              |

Treat empty Learning Room as a product failure mode: content is part of P1 delivery, but **volume stays tiny until the bet is validated**.

---

## 9. Revision log

| Date       | Change                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-05 | Initial SSOT from product discussion: curated lean library, narrative+situational mix, no memes/scrape/ebook-reader in MVP, admin CMS flow, five-title validation set (bodies deferred). |
