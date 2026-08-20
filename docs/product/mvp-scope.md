# Elynd V1 Feature Specification

V1 has one job: **be an excellent AI native language reading environment.**

Related: [`product-vision.md`](./product-vision.md) · [`product-principles.md`](./product-principles.md) · [`roadmap.md`](./roadmap.md) · [`content-strategy.md`](./content-strategy.md) · [`feature-audit.md`](./feature-audit.md)

This document is the **product target**. What already ships is recorded in [`feature-audit.md`](./feature-audit.md)—do not treat this file as an inventory of current code.

---

## 1. V1 definition

**V1 success:** A signed-in user can:

1. **Bring or open** authentic English (import a book / file, or pick from a small seed shelf)
2. **Read it** in a calm, book-like surface (resume where they left off)
3. **Unstick** with on-demand, **passage-grounded** AI
4. **Translate** when they need the meaning of a sentence or passage
5. **Listen** to the text (TTS)
6. **Keep reading**—no quiz, no review homework, no streak to protect

Returning users land on **continue the unfinished text**, not a study dashboard.

If they only sign in and see a learning-platform home, V1 has failed.

---

## 2. Must include

| Capability            | Notes                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Auth session          | Better Auth cookie session; first-party session via Next `/api` proxy                                       |
| Content import        | User brings a file into **their** library                                                                   |
| Real content pipeline | EPUB clean-up, chapter structure, book-like presentation—see [`content-strategy.md`](./content-strategy.md) |
| Reading experience    | Typography, pagination or continuous scroll, chapter/position resume                                        |
| AI companion          | Selection → explain / meaning in **this passage**; rail stays secondary; not a chat home                    |
| Translation           | Sentence or passage; bilingual view must not replace English as default                                     |
| TTS                   | Listen to the current text; degrade if audio is unavailable                                                 |

Seed / demo texts are allowed so first-run is not blocked on import. They are **not** a substitute for import.

---

## 3. Must not include (V1)

| Out of V1                                   | Why                                                      |
| ------------------------------------------- | -------------------------------------------------------- |
| Gamification / XP / shame streaks           | Duolingo                                                 |
| Word-count / vocab-collecting as the center | LingQ                                                    |
| SRS / daily cards / forced review           | Anki                                                     |
| Complex review / practice / quiz            | Second loop                                              |
| Chat as home / chatting as the core         | ChatGPT reading plugin                                   |
| AI-generated article library                | Content factory                                          |
| Speaking training / AI avatar / video chat  | Not a reading environment                                |
| Public social feed                          | Distraction from the page                                |
| Kitchen-sink control panels                 | Readest/TextStack study chrome we explicitly do not copy |

Do not “fill V1” with Phase 2 ideas. See [`roadmap.md`](./roadmap.md).

---

## 4. Core user journeys (product)

Full navigation SSOT: [`prototype-flows.md`](./prototype-flows.md).

### 4.1 First-time

```text
Sign in
  → Home / shelf (empty or seed)
  → Upload or choose authentic content
  → Open reader
  → Read
  → Language barrier → contextual help / translation / TTS
  → Keep reading
```

### 4.2 Daily

```text
Open Elynd
  → Resume last unfinished document
  → Read
  → Help when stuck
  → Keep reading
  → Leave (closing the book completes the session)
```

There is no required Practice or Review step.

---

## 5. Content stance for V1

**Full SSOT:** [`content-strategy.md`](./content-strategy.md).

| Topic          | V1 stance                                                                     |
| -------------- | ----------------------------------------------------------------------------- |
| Primary supply | **User import** (ebook / file)                                                |
| Pipeline       | Clean EPUB, order chapters, present like a book—**not** rewrite into a course |
| Seed library   | Optional, small                                                               |
| Unit           | A **document** the user is reading—not a lesson                               |
| Scraping       | Out                                                                           |

---

## 6. AI / privacy / cost (V1 constraints)

- AI only for **in-text** assistance and translation of the current document (current passage; this document’s help thread if it already exists)
- **Degrade path:** the document still opens without AI or TTS
- Do not send more context than needed; no always-on companion chat
- Cost: short prompts tied to selection / sentence / current chapter—not whole-library RAG theater
- If AI is used to parse or structure an import, that is infrastructure, not a “generate English” feature

---

## 7. How to use this doc in planning

1. Confirm the work is **in** V1 (§2) and not in §3
2. Answer: _Does this help the user keep reading this page?_ If it creates a study task → stop
3. Run [`feature-decision-guide.md`](./feature-decision-guide.md)
4. Walk [`design-guardrails.md`](./design-guardrails.md) before merge
5. If existing code conflicts, follow [`feature-audit.md`](./feature-audit.md)—**do not delete modules in passing**
