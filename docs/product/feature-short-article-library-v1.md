# Feature: Short-article Library loop (v1)

**Status:** Agreed in product discussion (2026-08-11). Independent feature brief—not a mandate to implement in one task.  
**Splits into:** multiple engineering tasks (see §6). Do not ship this whole brief as a single change set.

Related SSOT: [`content-strategy.md`](./content-strategy.md) · [`mvp-scope.md`](./mvp-scope.md) · [`product-vision.md`](./product-vision.md)

---

## 1. Problem

We need a **first content → Library → read** loop for adults who cannot persist: one sitting ≈ **5–20 minutes**, low pressure, no course syllabus wall.

EPUB ingest + in-model rewrite of long books is **deferred**: parsing cost and LLM context limits make it a poor v1 bet. Multi-source adapters (RSS, news, etc.) come later; they must still target the same learner atom.

---

## 2. Learner atom (locked)

| Decision             | v1 stance                                                                            |
| -------------------- | ------------------------------------------------------------------------------------ |
| Unit                 | One **short article** (session piece), not an ebook shelf or TOC-first book          |
| Length               | Target **~200–280 words**; **hard cap 300**                                          |
| Level                | Default **`easy`** (operator may edit the field; no AI leveling in v1)               |
| Library presentation | Default browse/list by **article**; optional **weak series** grouping                |
| After finish         | **Soft** “next in series” (skippable, no progress punishment)                        |
| In-reader (v1)       | **Pure read** only: title + body (paragraphs OK). No TTS, no tap-assist, no practice |

**Series (weak):** same-source / same-collection grouping for discovery and soft next—not a required chapter path.

---

## 3. Operator flow (v1)

```text
Paste / type article fields into admin form
  → Save as draft (edit anytime)
  → Publish
  → Appears in Library
  → Learner opens article → pure read
  → Optional soft “next in series”
```

### 3.1 Fields (minimum)

| Field              | Required | Notes                                              |
| ------------------ | -------- | -------------------------------------------------- |
| `title`            | Yes      |                                                    |
| `body`             | Yes      | English text; respect length cap                   |
| `level`            | Yes      | Default `easy`                                     |
| `themes` / tags    | Yes      | e.g. story, situational                            |
| `sourceNote`       | Yes      | Provenance (original, external AI draft, rewrite…) |
| `status`           | Yes      | `draft` \| `published`                             |
| `seriesId` / order | Optional | Weak series + soft next                            |
| `estimatedMinutes` | Optional | ~5–15                                              |

Content may be written by the operator or **drafted in an external AI** and pasted in. **No in-app generation and no file upload in v1.**

---

## 4. Explicit non-goals (v1)

- EPUB / document upload or parse
- In-app AI generate / light-rewrite pipeline
- In-app EPUB reader or learner ebook import
- TTS / audio, tap-to-explain, practice items
- Strong serial progress, syllabus, or dense TOC as the primary entry
- RSS / news / blog adapters (same article model later)

### 4.1 Later adapters (direction only)

Future sources (EPUB chunked rewrite, RSS, etc.) should **emit the same article (+ optional series)** shape. EPUB must be **chunked** before any model call—never “whole book in one prompt.”

---

## 5. Acceptance (feature-level)

v1 is done when:

1. Operator can create/edit a draft article via paste form and publish/unpublish.
2. Learner sees **published** articles in Library (not drafts).
3. Learner can open an article and read title + body without assist/audio.
4. If two+ articles share a series with order, finishing one may offer soft next; ignoring it is fine.
5. Bodies are intended to stay ≤300 words (product rule; validation strength is a task detail).

---

## 6. Suggested task breakdown (for humans to spawn)

Implement **one slice per Trellis/engineering task**. Order is a recommendation, not a commit plan.

| #   | Slice                     | Outcome                                           | Depends on |
| --- | ------------------------- | ------------------------------------------------- | ---------- |
| T1  | Article persistence + API | Draft/publish CRUD; learner list/detail read APIs | —          |
| T2  | Admin paste form          | Create/edit/publish UI for operators only         | T1         |
| T3  | Library UI                | List/discover published articles                  | T1         |
| T4  | Pure reader               | Article detail read view                          | T1, T3     |
| T5  | Weak series + soft next   | Series fields + post-read soft CTA                | T1–T4      |

Optional later (not v1): in-app generate, EPUB chunk adapter, TTS, assist, practice.

---

## 7. Doc ownership

- **This file** = SSOT for **this feature point** (v1 short-article Library loop).
- [`content-strategy.md`](./content-strategy.md) remains library/genre/supply philosophy; it should **point here** for the v1 paste→publish→read path.
- When a slice ships, update this brief’s status or add a short revision-log row—do not fork a second conflicting v1 scope.

---

## 8. Revision log

| Date       | Change                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-11 | Initial brief from product discussion: paste-only v1; EPUB/AI deferred; weak series + soft next; pure read; suggested T1–T5 splits. |
| 2026-08-11 | T1 shipped: article table + admin CRUD/publish + learner published reads (no UI wiring yet).                                        |
| 2026-08-11 | T2 admin paste form wired to real article APIs (list/create/edit/publish/unpublish).                                                |
| 2026-08-11 | T3 Library shelf + minimal T4 pure reader wired (`/library`, `/library/[id]`).                                                      |
