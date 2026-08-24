# Gloaming V1 Feature Specification

V1 has one job: **be an excellent AI native language reading environment.**

Related: [`product-vision.md`](./product-vision.md) · [`product-principles.md`](./product-principles.md) · [`mvp-1-modules.md`](./mvp-1-modules.md) · [`roadmap.md`](./roadmap.md) · [`content-strategy.md`](./content-strategy.md) · ADR-001 [`../adr/001-reading-content-domain-model.md`](../adr/001-reading-content-domain-model.md)

This document is the **capability** target (must / must-not). Module inventory: [`mvp-1-modules.md`](./mvp-1-modules.md). Shipped code vs target: [`feature-audit.md`](./feature-audit.md).

---

## 1. V1 definition

**V1 success:** A signed-in user can:

1. **Discover and open** authentic English from the official catalog (**ReadingWork**)
2. **Read it** in a calm, book-like surface (resume via **ReadingState** on the current **ReadingPart**)
3. **Unstick** with on-demand, **passage-grounded** AI
4. **Translate** when they need the meaning of a sentence or passage
5. **Listen** to the text (TTS on the current part)
6. **Keep reading**—no quiz, no review homework, no streak to protect

Returning users land on **continue the unfinished book**, not a study dashboard.

If they only sign in and see a learning-platform home, V1 has failed.

---

## 2. Must include

| Capability               | Notes                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Auth session             | Better Auth cookie session; first-party session via Next `/api` proxy              |
| Official catalog → shelf | Browse **发现**, add to **我的书架** (creates **ReadingState**)                    |
| **Admin EPUB upload**    | Ops uploads EPUB → processing → **ReadingWork** + **ReadingPart[]** → publish      |
| **EPUB processing**      | Clean EPUB, chapter structure — admin pipeline in MVP 1a                           |
| Reading experience       | Typography; chapter/part navigation; resume part + anchor                          |
| AI companion             | Selection → explain in **this passage**; thread on **reading_work**; not chat home |
| Translation              | Sentence or passage; bilingual view must not replace English as default            |
| TTS                      | Listen to **current part**; degrade if audio unavailable                           |
| User import              | Phase **1b** — not required to ship MVP 1                                          |

Official catalog = admin-published **ReadingWorks**. Do not block MVP on **user** upload.

---

## 3. Must not include (V1)

| Out of V1                                   | Why                                 |
| ------------------------------------------- | ----------------------------------- |
| Gamification / XP / shame streaks           | Duolingo                            |
| Word-count / vocab-collecting as the center | LingQ                               |
| SRS / daily cards / forced review           | Anki                                |
| Complex review / practice / quiz            | Second loop                         |
| **Lesson system / course progression**      | Course app identity                 |
| **Practice loop**                           | Removed from codebase               |
| Chat as home / chatting as the core         | ChatGPT reading plugin              |
| **AI-generated article library**            | Content factory                     |
| **Short Article Library** as product        | Superseded by ReadingWork (ADR-001) |
| Speaking training / AI avatar / video chat  | Not a reading environment           |
| Public social feed                          | Distraction from the page           |
| Kitchen-sink control panels                 | Study chrome we do not copy         |
| **User upload** in learner UI               | Phase 1b                            |

Do not “fill V1” with Phase 2 ideas. See [`roadmap.md`](./roadmap.md).

---

## 4. Core user journeys (product)

Full navigation SSOT: [`prototype-flows.md`](./prototype-flows.md).

### 4.1 Core loop

```text
Discover
  → Choose ReadingWork
  → Add to Shelf (ReadingState)
  → Reader (ReadingPart)
  → Encounter difficulty
  → AI Assist
  → Continue Reading
```

### 4.2 First-time

```text
Sign in
  → 我的书架 (empty or few items)
  → 发现 → 加入书架 (or open)
  → Reader
  → Read
  → Language barrier → contextual help / translation / TTS
  → Keep reading
```

(No **user** upload in MVP 1 — admin supplies catalog via EPUB.)

### 4.3 Daily

```text
Open Gloaming
  → Resume last unfinished ReadingWork (我的书架)
  → Read current ReadingPart
  → Help when stuck
  → Keep reading
  → Leave
```

There is no required Practice or Review step.

---

## 5. Content stance for V1

**Full SSOT:** [`content-strategy.md`](./content-strategy.md).

| Topic        | Stance                                                          |
| ------------ | --------------------------------------------------------------- |
| MVP 1 supply | **Admin EPUB** → published **ReadingWork** catalog via **发现** |
| User import  | Phase **1b**                                                    |
| Unit         | **ReadingWork** (+ **ReadingPart** for text) — not a lesson     |
| `admin_text` | Internal dev/test fallback only                                 |
| Scraping     | Out                                                             |

---

## 6. AI / privacy / cost (V1 constraints)

- AI only for **in-text** assistance and translation of the **current part** (help thread scoped to **reading_work** if it exists)
- **Degrade path:** the work still opens and reads if AI or TTS is off
- Do not send more context than needed; no always-on companion chat
- Cost: short prompts tied to selection / sentence / **current part**—not whole-library RAG theater
- EPUB parsing is infrastructure, not “generate English”

---

## 7. How to use this doc in planning

1. Confirm the work is **in** V1 (§2) and not in §3
2. Answer: _Does this help the user keep reading this page?_ If it creates a study task → stop
3. Run [`feature-decision-guide.md`](./feature-decision-guide.md)
4. Walk [`design-guardrails.md`](./design-guardrails.md) before merge
5. Domain names: [`engineering-vocabulary.md`](./engineering-vocabulary.md)

---

## Revision log

| Date       | Change                                                                                |
| ---------- | ------------------------------------------------------------------------------------- |
| 2026-08-24 | ReadingWork loop; admin EPUB must; lesson/practice/article library must-not; ADR-001. |
