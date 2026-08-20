# Gloaming Content Strategy

SSOT for **what people read** and **how it enters Gloaming**—under the AI Native Language Reading Environment bet.

Related: [`mvp-scope.md`](./mvp-scope.md) · [`product-vision.md`](./product-vision.md) · [`feature-audit.md`](./feature-audit.md)

**Language:** Product docs are English. User-facing copy may be Chinese.

---

## 1. Purpose of content

Content exists so someone can **read real English**.

Gloaming is not a corpus-building project, not a course publisher, and not an AI writing mill.

**Primary:** the user brings a text they want to read (books, novels, articles, news, technical docs, essays, or any English they chose).  
**Secondary:** a small seed shelf so first-run is not blocked.  
**Never:** generated “learning English” articles as the product. Gloaming does not manufacture learning materials.

---

## 2. Scope decisions (locked 2026-08-20)

| Decision                                          | V1 stance                                                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supply model                                      | **User import first** (ebook / file → their library)                                                                                                       |
| Real content pipeline                             | **In V1** — clean EPUB, organize chapters, present like a book. Do **not** rewrite into lessons                                                            |
| Seed / demo texts                                 | Optional, small; team-owned or clearly licensed                                                                                                            |
| Admin paste CMS                                   | **Keep as ops/seed** until import is real; not the identity ([`feature-short-article-library-v1.md`](./feature-short-article-library-v1.md) is historical) |
| Scraping / crawl                                  | **Out**                                                                                                                                                    |
| AI rewrite of the user’s book into graded lessons | **Out** — that is a content generator                                                                                                                      |
| AI at read time                                   | Explain / translate / TTS on **this** document                                                                                                             |
| Memes / joke packs / syllabus trees               | **Out** of identity                                                                                                                                        |
| User-generated marketplace                        | **Out** of V1                                                                                                                                              |

Older lock (2026-08-05) said curated short articles in, user import deferred. **That lock is superseded.**

---

## 3. What “authentic” means here

Authentic = **not manufactured as an Gloaming lesson**.

Examples that fit:

- A book the user already owns (EPUB)
- An essay or article they saved (when file import supports it)
- A seed short text that is still a _piece of writing_, not a worksheet

Examples that do not:

- AI-written “B1 daily story” farms
- Dialogue drills
- Vocab-pack paragraphs

Difficulty is handled by **help on the page**, not by only shipping easy fables. Seed texts may still be shorter/easier so a first session is kind—without pretending the product is a graded reader catalog.

---

## 4. Document shape (product contract)

The reading atom is a **document they are in the middle of**, not “today’s 250-word unit.”

### 4.1 V1 fields (intent)

| Concern                          | V1 need                                                   |
| -------------------------------- | --------------------------------------------------------- |
| Title                            | Yes                                                       |
| Body or ordered parts (chapters) | Yes — ebooks are not one blob if the format has structure |
| Source                           | Import vs seed; rights/provenance for seed                |
| Owner                            | User-owned import vs published seed                       |
| Reading position                 | Per user × document (and chapter if parts exist)          |
| Level / tags                     | Optional metadata; **not** a syllabus                     |

Exact schema is an engineering decision ([`feature-audit.md`](./feature-audit.md) §4.1). Product rule: **one kind of thing you read**, not Article-the-lesson plus Book-the-other-app.

### 4.2 Length

No 300-word cap on imported books. Seed pieces may stay short so a first sitting is easy.

---

### 4.3 Real content pipeline (after upload)

User-imported files should **read like a book**, not like a dumped zip of HTML.

```text
Upload authentic file
  → Clean EPUB (strip junk, keep the work)
  → Organize chapters
  → Book-like typography in the reader
```

This is presentation and structure. It is **not** simplifying, grading, or generating a parallel “learning” text.

---

## 5. End-to-end flows

### 5.1 Learner (V1)

```text
Import file or pick seed
  → Shelf (my library)
  → Reader (read + optional listen + on-demand assist / translation)
  → Resume next time
```

No practice or review step.

### 5.2 Import (V1)

```text
Choose EPUB (or text)
  → Clean + chapter structure (real content pipeline)
  → Store as the user’s document
  → Open at the start (or last position)
```

Parse failures must be explicit. Do not silently send the whole book through an LLM to “simplify.”

### 5.3 Seed / admin (until import carries the product)

```text
Operator pastes or edits a seed text
  → Publish
  → Appears as seed on the shelf (not as “today’s lesson”)
```

Users do not edit the seed catalog. They do own their imports.

### 5.4 What we do not run

```text
Crawl the web → auto-AI “course” → ship to users
LLM rewrites this novel into units with quizzes
```

---

## 6. Quality bar

A seed piece is publishable only if:

1. A reader might **want to finish it**
2. Source/rights are clear
3. It does not push Gloaming toward **course pack**, **vocab list**, **chatbot**, or **AI-generated library**

Imported user content is not “quality-reviewed” by us beyond parse safety (size limits, format, malware/DoS basics). We do not become their editor.

---

## 7. Phase note

| When         | Content work                                                       |
| ------------ | ------------------------------------------------------------------ |
| V1 (Phase 1) | Import + EPUB parse + reader on that document; seed optional       |
| Phase 2+     | Only if Phase 1 is used as a reader—more sources, not a CMS empire |

Empty reader is a failure mode. Filling it with generated articles is a worse failure mode.

---

## 8. Revision log

| Date       | Change                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 2026-08-20 | Name the real content pipeline (clean / chapters / book-like present). Reading Environment wording. |
| 2026-08-20 | Supersede curated-article MVP: user import + ebook parse in V1; seed CMS demoted.                   |
| 2026-08-11 | Pointed v1 admin path to paste-only feature brief (historical).                                     |
| 2026-08-05 | Initial curated lean library SSOT.                                                                  |
