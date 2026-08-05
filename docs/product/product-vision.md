# Elynd Product Vision

**Canonical one-liner:** Elynd is an English **learning space** for adults who struggle to stick with learning. It centers **interesting, mostly understandable real content** (reading + listening), with tools—including AI—that **lower friction**. It is not a course platform, vocab pack, or chatbot.

Related docs:

- Learning science: [`learning-philosophy.md`](./learning-philosophy.md)
- Feature decisions: [`feature-decision-guide.md`](./feature-decision-guide.md)
- Anti-drift guardrails: [`design-guardrails.md`](./design-guardrails.md)
- MVP / modules / metrics: [`mvp-scope.md`](./mvp-scope.md), [`success-metrics.md`](./success-metrics.md)
- Content supply (curated library): [`content-strategy.md`](./content-strategy.md)
- Index: [`README.md`](./README.md)

---

## 1. Name

Elynd

---

## 2. Mission

Help people who want better English but cannot persist—by making **low-pressure, meaningful input** a daily habit, not a willpower contest.

---

## 3. Who we serve

Adults who already know English matters, but:

- Bought courses and quit
- Installed apps and abandoned them
- Tried native texts and felt crushed
- Feel anxiety every time they “should study”

**Core shortage is not resources.** It is:

1. Content at the right difficulty and interest
2. Sustainable motivation (interest > grit)
3. Immediate help when stuck
4. Gentle return paths and companionship—not a teacher or exam proctor

---

## 4. Product principles

### Learn less, continue longer

Default sessions: **5–20 minutes**. Lower startup cost. Ability grows from accumulation.

### Meaningful input first

Learn through **real, interesting messages**—not drills as the main path.

### One material, full loop

One piece of content serves:

Discover → Read / listen → Understand (with assist) → Light practice (optional) → Re-meet (Review) → Habit (Progress)

### AI lowers friction; it does not replace learning

AI explains, adapts difficulty, asks about **this** text, and gives mild feedback.  
It must not become the homepage identity or a path to skip reading.

---

## 5. Positioning

**Elynd is not:**

- An English course platform
- A vocabulary memorization tool
- An AI chatbot
- A plain e-reader

**Elynd is:**

An **input-first English learning space**—closer to a guided reading room than to a classroom or chat app.

Loop in product language:

```text
Find content → Understand (read/listen + assist) → Practice gently → Re-meet → Form a habit
```

Product spaces (prototypes under `prd/`):

| Space               | Role                                                 |
| ------------------- | ---------------------------------------------------- |
| Library / discovery | Find interesting, level-fit content                  |
| Learning Room       | Quiet read + listen + on-demand assist               |
| Practice            | Confirm understanding / light output **after** input |
| Review              | Re-meet important expressions in context             |
| Progress            | See time-with-language and habit—not exam scores     |

---

## 6. Personality

Elynd feels like a **smart, warm reading companion**.

Not a teacher. Not an exam supervisor.

Opening the app should feel like:

> “I’m back to continue.”

Not:

> “I have to start class.”

---

## 7. Experience goals

| Moment        | Feeling                                              |
| ------------- | ---------------------------------------------------- |
| First open    | Real product, not a demo                             |
| First session | “English learning can feel this light.”              |
| Ongoing use   | “I’m building a habit / spending time with English.” |

---

## 8. Decision rule

When unsure, ask:

> Does this help the user spend more time **understanding interesting English**, with less anxiety—or does it create another study task?

Prefer the former. Cut or redesign the latter.

See [`feature-decision-guide.md`](./feature-decision-guide.md) and [`design-guardrails.md`](./design-guardrails.md).
