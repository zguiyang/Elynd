# Gloaming Success Metrics

What we measure so building stays honest. Numbers serve the philosophy—they do not replace it.

Related: [`product-vision.md`](./product-vision.md) · [`mvp-scope.md`](./mvp-scope.md) · [`design-guardrails.md`](./design-guardrails.md)

---

## 1. North star

> **Weekly minutes of engaged reading of authentic English per active user.**

“Engaged” means time in the **reader** with the document (scroll/page progress, not an idle tab). Listening to the same text (TTS) may count as the same session if they stay with the book. Refine instrumentation later; keep the intent fixed.

If this rises while quiz completion, chat-as-home, or “opened app but never opened a book” also rise, **north star is not enough**—check drift metrics.

---

## 2. Product metrics (prefer these)

| Metric                              | Why it matters                         | V1 note                                            |
| ----------------------------------- | -------------------------------------- | -------------------------------------------------- |
| Weekly reading minutes              | Directly tracks time in authentic text | Instrument in the reader                           |
| Documents opened / resumed per week | Low friction to continue a book        | Resume is a first-class event                      |
| Import success rate                 | V1 supply                              | Failures must be visible, not silent               |
| Session continues after assist      | Help served reading                    | Assist then return to page > assist-only           |
| Assist usage per reading-minute     | Friction relief                        | Watch assist-only sessions with no progress        |
| D1 / D7 return (reading days)       | Habit of opening the book              | Reading day = had a reader session, not only login |

Do **not** treat practice completion, review return, or words “saved” as V1 success metrics.

---

## 3. Drift / vanity metrics (watch or de-prioritize)

| Metric                         | Risk if optimized blindly           |
| ------------------------------ | ----------------------------------- |
| AI chat turns                  | Can rise while reading falls        |
| Practice / review completion   | Pulls back to course/Anki identity  |
| Streak length                  | Shame mechanics                     |
| Words “collected”              | LingQ/Anki identity                 |
| Time in app (undifferentiated) | Settings and menus                  |
| Seed **works** opened but reader broken | Ignores whether EPUB/reader pipeline works |

**Rule:** If a metric can go up while north-star minutes go down, do not use it as a primary success signal.

---

## 4. Qualitative checks

Ship reviews should still answer:

1. Did first success feel like **I read a real page**—or I finished a chore?
2. Would someone who wanted Apple Books + language help recognize this product?
3. With AI off, does the document still open?

---

## 5. Phase targets (directional, not contracts)

| Phase                   | Signal                                                                            |
| ----------------------- | --------------------------------------------------------------------------------- |
| 1 — Reading environment | Import or seed → helped read session; minutes logged; return to the same document |
| 2 — Companion           | Help feels tied to _this_ book (qualitative); reading minutes still primary       |
| 3 — Growth              | Volume/depth of reading—not a new drill KPI                                       |

Exact numeric OKRs wait until events exist. **Do not invent fake targets.**

---

## 6. Experiment guardrail

Any experiment must declare:

- **Primary:** a metric from §2 (ideally north star or resumes + minutes)
- **Guardrail:** reading minutes must not fall; chat/practice must not replace reader time

If primary wins and guardrail loses → do not ship.
