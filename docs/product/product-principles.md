# Gloaming Product Principles

How we decide what belongs in the product. Companion to [`product-vision.md`](./product-vision.md).

Day-to-day checks: [`feature-decision-guide.md`](./feature-decision-guide.md) · [`design-guardrails.md`](./design-guardrails.md).

---

## 1. Reading first

Reading is the product.

Not: reading **plus** a learning module.  
Reading **is** how language grows here.

If a feature does not help the user start a text, stay in a text, or understand **this page**, it is not V1.

Do not add a second loop (practice, review, chat, generate) and then “balance” it with reading.

The first action on return: **continue the unfinished text**—not study, not a task, not a streak check-in.

---

## 2. Real content first

Users read **English they chose**: books, novels, articles, news, technical docs, essays, or anything else they care about.

Gloaming does not manufacture learning materials. The user chooses. Gloaming lowers the cost of understanding.

A small seed shelf is allowed so first-run is not a dead end. It must not become the identity.

---

## 3. Calm reading experience

The surface should feel like **Apple Books**, **TextStack**, and **Readest**: typography, page, quiet chrome. What to learn from each: [`product-vision.md`](./product-vision.md) §8.

No XP, no shame streaks, no “today’s tasks,” no lesson walls. A session can end by closing the book.

Opening Gloaming should feel like:

> “I’m back to continue a book.”

Not:

> “I have to start a learning task.”

---

## 4. AI as companion

Not: an AI-teacher home, a chatbot, or a course assistant.

> **AI should disappear when it is not needed.**

Behavior: appear when the user asks; help them understand; recede.

Help is **contextual**—the current passage, this document. If they already asked for help on this text, that thread may continue. This is **not** ordinary ChatGPT and **not** a ChatGPT reading-plugin (chat is not the home screen or the core activity).

| Allowed                                      | Not allowed                                      |
| -------------------------------------------- | ------------------------------------------------ |
| Explain this word / sentence in this passage | Free-topic chat as home                          |
| Translate this sentence or this page         | “Summarize so you needn’t read” as the main path |
| Read the text aloud (TTS)                    | AI as teacher, tutor, or curriculum              |
| Answer a question about **this** text        | Generating a fake library to replace real books  |

**Degrade path:** if AI is off, the book still opens and still reads.

---

## 5. Help is local and on demand

Help lives next to the selection: tap a word, mark a sentence, ask.

Do not require a mode switch into “study.” Do not collect a vocab homework list as the reason to open Gloaming.

---

## 6. Volume of input, not completeness of a system

Language grows from **time spent understanding messages**, not from covering a feature checklist.

V1 does not need SRS, speaking, video, avatars, or a growth dashboard to be a complete product. An excellent reading environment is complete.

---

## 7. Do not borrow identity from competitors

| Temptation                                | Default answer              |
| ----------------------------------------- | --------------------------- |
| Duolingo-style lessons / XP / streaks     | No                          |
| LingQ-style word stats as the center      | Lookup yes; stats-center no |
| Anki-style review / daily cards           | No. Not the loop            |
| ChatGPT-style plugin / tutor home         | Assist in the book only     |
| “AI writes your English”                  | Users bring texts           |
| Kitchen-sink panels / learning dashboards | No                          |

“Competitors have it” is not a reason to ship it. “Apple Books / TextStack / Readest do it” **is** a reason to **study** the reading interaction—then still pass V1 and the tests above. Do not copy SRS, learning stats, or multi-tool panels.

---

## 8. One-line reset

> **Does this help the user keep reading this page?**

If it creates another study task, stop.
