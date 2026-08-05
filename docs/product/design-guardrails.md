# Elynd Design Guardrails

Use during **reviews, prototype walkthroughs, and post-ship retros** to catch drift early.

Related: [`feature-decision-guide.md`](./feature-decision-guide.md) · [`product-vision.md`](./product-vision.md) · [`learning-philosophy.md`](./learning-philosophy.md)

---

## 1. What “drift” means

Drift = a feature may be polished or metric-positive, but no longer serves:

> Adults who fail to persist get low-pressure time understanding real English.

Common disguises: “industry standard,” “competitors have it,” “AI must be stronger,” “growth first, philosophy later.”

Standards inform; they do not override philosophy.

---

## 2. Red lights (any one → pause merge)

### 2.1 Identity rewrite

| Red light                               | Why                        | Pull back                                |
| --------------------------------------- | -------------------------- | ---------------------------------------- |
| Home CTA is “Start chat / Start course” | Chatbot or class identity  | CTA → continue reading / today’s content |
| Users “check in” with almost no reading | Task replaces input        | Tie completion to reading/listening      |
| Empty states push quiz/AI, not content  | Side loop owns the product | Guide to pick or resume a text           |

### 2.2 Pressure / willpower return

| Red light                                 | Why                       | Pull back                                   |
| ----------------------------------------- | ------------------------- | ------------------------------------------- |
| Streak shame, public failure              | Raises affective filter   | Mild nudges; allow breaks; ban shame copy   |
| Default daily plan ≥ 60 min or many steps | Plan exceeds habit        | Default a 5–20 minute complete path         |
| Hard walls “must finish to proceed”       | Learning as dungeon crawl | Allow skip / later; keep voluntary continue |

### 2.3 Input shredded

| Red light                                  | Why                              | Pull back                                  |
| ------------------------------------------ | -------------------------------- | ------------------------------------------ |
| Memorize N words before unlock reading     | Skill-building over meaning      | Words in context; pre-study minimal        |
| Article broken into unrelated micro-drills | Breaks “one material, full loop” | Practice points back to the same text      |
| Word cards only, no passage                | Becomes vocab app                | Review shows source sentence; jump to text |

### 2.4 AI overreach

| Red light                                    | Why                       | Pull back                                         |
| -------------------------------------------- | ------------------------- | ------------------------------------------------- |
| Chat is the default home                     | Elynd ≠ chatbot           | AI secondary; after content                       |
| “Summarize so you needn’t read” as main path | Skips understanding       | Summary assist only; reading remains default      |
| Selling “smartest model / agents”            | Sells tech, not mechanism | Talk friction reduction and reading companionship |
| Core path unusable without AI                | Tool became the product   | Degraded reading still works                      |

### 2.5 Output too early / too heavy

| Red light                            | Why                  | Pull back                                      |
| ------------------------------------ | -------------------- | ---------------------------------------------- |
| Force speak/write before reading     | Violates input-first | Gate output after comprehension                |
| Harsh correction, high speaking cost | Anxiety              | Meaning first; correction optional             |
| Practice time dwarfs reading         | Inverted priorities  | Reading primary; practice short and text-bound |

### 2.6 Review becomes Anki

| Red light                         | Why                   | Pull back                            |
| --------------------------------- | --------------------- | ------------------------------------ |
| Review shows words without source | Loses “re-meet”       | Always show sentence; link back      |
| “Must memorize N today” KPI       | Willpower contest     | “Available to re-meet”; allow skip   |
| Opaque schedule creates dread     | System feels coercive | Copy = “come back”; cap daily volume |

---

## 3. Yellow lights (allowed with constraints)

| Yellow                             | Constraint                                                |
| ---------------------------------- | --------------------------------------------------------- |
| Points / light gamification        | Must not be the goal; no public humiliation               |
| “Lesson N” framing                 | Optional path only; default remains self-selected content |
| Social share                       | Share ok; crushing leaderboards no                        |
| Exam-oriented topics (IELTS, etc.) | Content theme ok; product must not become test coach      |
| Push notifications                 | Rare, dismissible, no guilt copy                          |
| Fancy dashboards                   | Prefer time/items read; avoid fake “ability scores”       |

Yellow features need **success metrics + kill metrics** before ship.

---

## 4. Walkthrough checklist

**Identity**

- [ ] First screen reads as reading/learning space, not chat or course
- [ ] Tone is companion + reading, not efficiency SaaS

**Main loop**

- [ ] User can touch real English content within ~30 seconds
- [ ] Assist does not forcibly break immersion
- [ ] If practice exists, it maps to a specific text

**Pressure**

- [ ] No streak shame, public failure, or mandatory giant tasks
- [ ] A session can feel complete in ~5–20 minutes

**AI**

- [ ] AI is assist, not home hero
- [ ] Reading works with AI off (degrade path clear)

**Memory**

- [ ] Review returns to context, not isolated word lists

**Metrics**

- [ ] Success includes input time / reading completion—not only clicks or chat turns

---

## 5. Retro prompts (after ~2 weeks)

1. Did users spend more time **reading**, or more time in menus/chat?
2. Was first success “understood a passage” or “finished a task”?
3. If we deleted the feature, does the main loop clearly weaken? If not, it may be noise.
4. Any feedback like “exhausted / ashamed / don’t know what I’m learning”? Fix pressure and narrative first.

---

## 6. Competitor temptation table

| They ship                  | Our first reaction                               |
| -------------------------- | ------------------------------------------------ |
| Heavy AI speaking coach    | Later, not home/identity                         |
| Classic SRS vocab          | Spacing ok; narrative must be contextual re-meet |
| Public streak leaderboards | Prefer private mild continuity                   |
| Full course trees          | Not default path; library ≠ forced syllabus      |
| “Improve 300%” claims      | Ban; explain mechanism and feeling instead       |

---

## 7. Final vote

> **Does this move users toward “willing to read a little English daily,” or toward “another study app to abandon”?**

Former → proceed. Latter → change or cut.
