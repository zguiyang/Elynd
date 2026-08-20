# Gloaming Product Vision

**Canonical one-liner:** Gloaming is an **AI Native Language Reading Environment**. It helps people read authentic English the way they use a modern ebook reader, with contextual AI help when meaning breaks down.

The core is **not** teaching language. The core is:

> Help people **keep reading English they actually want to read**.

Related docs:

- Principles: [`product-principles.md`](./product-principles.md)
- Why reading works: [`learning-philosophy.md`](./learning-philosophy.md)
- V1 feature specification: [`mvp-scope.md`](./mvp-scope.md)
- Roadmap: [`roadmap.md`](./roadmap.md)
- Feature decisions: [`feature-decision-guide.md`](./feature-decision-guide.md)
- Anti-drift: [`design-guardrails.md`](./design-guardrails.md)
- Index: [`README.md`](./README.md)

---

## 1. Name

Gloaming

---

## 2. Positioning

Gloaming is a **reading environment**, not a learning-management product.

```text
Choose authentic English
  → Open and read
  → Hit a language barrier
  → Get contextual help
  → Keep reading
  → A reading habit forms
```

Language ability grows as a **side effect of volume**: enough interesting input, mostly understood, over time.

The first thing a returning user does is **not** study, finish a task, or check in. It is:

> Continue the book (or article) they had not finished.

---

## 3. Mission

Help people **read real English they care about**—books, novels, articles, news, technical writing, essays, or any English they chose—by lowering the cost of understanding, without turning reading into a course, a drill, or a chat.

Gloaming does **not** manufacture learning materials. The user chooses the text. Gloaming lowers the barrier.

---

## 4. Who we serve

**No age gate.** Gloaming is for anyone who wants to grow English by reading authentic content.

They are not short of English materials. They are short of:

> An environment where they can keep reading real English, and get help when they get stuck.

| Persona                 | They might                                                      | Shared need         |
| ----------------------- | --------------------------------------------------------------- | ------------------- |
| **Students**            | Read English books beyond class; grow vocabulary through volume | Stay in a real text |
| **Adult learners**      | Read originals; leave courses behind; follow interest           | Same                |
| **English enthusiasts** | Novels, news, technical docs, overseas writing                  | Same                |
| **Advanced readers**    | Maintain input; go deeper into how English is used              | Same                |

They are not looking for a teacher. They are looking for a **place to read that does not leave them stuck**.

---

## 5. Core problem

Authentic English is interesting. It is also hard.

Most products respond by changing the activity:

| Typical product                    | What it actually asks you to do   |
| ---------------------------------- | --------------------------------- |
| Course / lesson app                | Follow a syllabus                 |
| Drill / game app                   | Complete exercises                |
| Vocab / SRS app                    | Memorize cards                    |
| Chatbot / “ChatGPT reading plugin” | Talk to a model                   |
| Content factory                    | Consume generated “learning text” |

Gloaming’s bet: **keep the activity as reading.** Use AI only to make this page readable.

---

## 6. What Gloaming is

Four ideas. Full decision rules: [`product-principles.md`](./product-principles.md).

| Idea                   | Meaning                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Reading first**      | Reading _is_ the product. Not “reading plus a study module.” Reading itself is how language grows here.                   |
| **Real content first** | Books, novels, articles, news, technical docs, essays—whatever the user wants. Gloaming does not invent a lesson library. |
| **AI as companion**    | Appears when needed, helps with **this passage**, then recedes. _AI should disappear when it is not needed._              |
| **Calm reading**       | Feels like coming back to a book—not starting today’s learning task.                                                      |

It should feel like:

> “I’m back to continue this book.”

Not:

> “I have to start class.”

---

## 7. What Gloaming is NOT

| Not this                                                     | We do not                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **Duolingo**                                                 | Gamification, XP, shame streaks, lesson trees                               |
| **LingQ**                                                    | Word-count as the core metric, a stats-center, vocab-collecting as the game |
| **Anki**                                                     | Forced review, daily card tasks, SRS as the main loop                       |
| **A ChatGPT reading plugin**                                 | Chat as the home screen; chatting as the core behavior                      |
| **An AI content factory**                                    | Batch-generated “English articles” as the main supply                       |
| A **course platform** / **AI teacher** / **practice system** | Syllabus, tutoring identity, quiz loop                                      |

A plain e-reader without language help is also not Gloaming. The difference is the **companion**, not a second product identity.

---

## 8. Experience references (borrow, do not copy)

For **feature design and UI interaction**, look first at these three. They are the closest cousins. **Not a spec. Not a clone.** V1 is still [`mvp-scope.md`](./mvp-scope.md).

| Product         | What it is                                                                                                                   | Learn                                                    | Do not copy                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------- |
| **Apple Books** | Apple’s official reader                                                                                                      | Typography, reading atmosphere, simple interaction       | —                                       |
| **TextStack**   | Open source ([textstack.app](https://textstack.app), [github.com/mrviduus/textstack](https://github.com/mrviduus/textstack)) | AI-in-the-book stance, UI tone, how content is organized | SRS / flashcards, learning stats        |
| **Readest**     | Open source ([readest.com](https://readest.com), [github.com/readest/readest](https://github.com/readest/readest))           | Ebook engineering, reader implementation                 | Multi-tool control panels, study chrome |

Also do **not** copy: learning statistics dashboards, or a kitchen-sink of panels.

Visual tokens stay in [`DESIGN.md`](../../DESIGN.md). These three inform **behavior and composition**, not our color/type system.

---

## 9. Personality

Gloaming feels like a **smart, quiet reading companion**.

Not a teacher. Not an exam supervisor. Not a content farm.

Opening the app should feel like opening a book with a knowledgeable friend sitting nearby—available, not performing.

---

## 10. Experience goals

| Moment        | Feeling                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| First open    | This is a place to read. I can bring something real, or open a text.     |
| First session | I read. When I got stuck, help was about **this** passage. I kept going. |
| Ongoing use   | I have a book in progress. I come back to it.                            |

---

## 11. Decision rule

Every request must answer:

> **Does this help the user keep reading this page?**

- Yes → consider (still check V1 and identity).
- It creates another study task → **refuse**.

See [`product-principles.md`](./product-principles.md), [`feature-decision-guide.md`](./feature-decision-guide.md), and [`design-guardrails.md`](./design-guardrails.md).
