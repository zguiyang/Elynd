# Elynd Feature Decision Guide

Use this when **planning or reviewing features**.  
Goal: keep every feature serving **sustainable comprehensible input**—not quietly becoming a course, vocab pack, or chatbot.

Related:

- [`product-vision.md`](./product-vision.md)
- [`learning-philosophy.md`](./learning-philosophy.md)
- [`design-guardrails.md`](./design-guardrails.md)
- [`mvp-scope.md`](./mvp-scope.md)

---

## 1. Problem we solve

Users are not ignorant of English’s value. They:

- Buy courses, install apps, save materials—then quit
- Face content that is too hard or too boring
- Lack right-level input, instant understanding help, gentle feedback, and re-meeting

**Success is not feature count.** Success is whether users willingly spend **5–20 minutes a day understanding real English**.

---

## 2. Four questions (required before build)

### Q1. Does it increase time with understandable, interesting English?

- Pass → candidate
- Fail → default no (unless critical safety/infra), and must not steal the main loop

### Q2. Does it lower startup friction or anxiety?

- Pass → aligns with low-pressure persistence
- Shame, punishment, heavy plans → drift

### Q3. Does it avoid turning Elynd into course / word list / chatbot?

- If users can “finish today’s task” with almost no reading → danger
- AI assists comprehension; it is not the main stage

### Q4. Where does it sit on the main loop?

```text
Discover → Read/listen → (optional) confirm / light output → Re-meet → Habit
```

If you cannot place it, it is probably a side quest.

---

## 3. Feature types and default stance

| Type                 | Examples                                            | Default          | Design note                               |
| -------------------- | --------------------------------------------------- | ---------------- | ----------------------------------------- |
| Main-loop strength   | Better reading, tap-to-explain, same-text listening | **Prioritize**   | Preserve immersion                        |
| Comprehension assist | Gloss, sentence help, level-tuned explain           | **Yes**          | On demand / light; do not hijack          |
| Post-input output    | Checks, text-grounded dialogue                      | **Yes, later**   | Only after understanding                  |
| Re-meeting           | Review                                              | **Should build** | “Meet again,” not flashcard app           |
| Habit visibility     | Progress                                            | **Yes**          | Time-with-language, not exam rank         |
| Social competition   | Leaderboards, public shame                          | **Default no**   | Becomes willpower contest                 |
| Courseification      | Fixed syllabus, pass walls                          | **Default no**   | Conflicts with “start reading, not class” |
| Free AI chat as home | Chat without text context                           | **Default no**   | Becomes chatbot product                   |

---

## 4. Review template (copy/paste)

```text
Feature name:
User scenario (who, what frustration):
Main-loop stage:
How it increases comprehensible-input time / lowers friction:
Without it, what gets worse:
Drift risks (course / vocab / chat / pressure):
Success metrics (prefer behavior over vanity):
Explicit non-goals:
```

Prefer behavioral metrics: weekly reading minutes, sessions started, abandon-from-difficulty rate, Review return rate.  
Be careful with AI chat turn count (high turns may mean reading was stolen).

---

## 5. Adding AI without drifting

AI’s only legal job:

> **Lower friction to stay inside real content.**

| Legal                                | Illegal                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| Explain words/sentences in this text | Default path that skips reading via summary              |
| Tune explanation depth               | Free chat as the home screen                             |
| Ask about this article               | Marketing “smarter models” instead of learning mechanism |
| Mild feedback                        | Dependency: unusable without AI                          |

Extra check: **If AI is off, does reading still work?** If no, redesign.

---

## 6. Priority heuristic

1. Make it easier to **start and continue reading**
2. Make what was read **stick** (Review)
3. Light **output after understanding** (Practice)
4. Show **habit**, not scores (Progress)
5. Growth/social/gamification last—and only if it passes the four questions

“Competitors have it” is not a reason.  
“Our philosophy needs it” is.

---

## 7. Philosophy → design cheat sheet

| Belief                                     | Design implication                                |
| ------------------------------------------ | ------------------------------------------------- |
| Language grows from understanding messages | Home is content, not a quiz bank                  |
| Interest beats grit                        | Choice and compelling topics > “must-learn” lists |
| Mostly understandable, slightly hard       | Leveling + assist around i+1 / high coverage      |
| Input before output                        | Practice does not outrank Learning Room           |
| Small daily doses                          | A complete win in ~5–20 minutes                   |
| Tools reduce friction                      | Lookup/explain fast, accurate, dismissible        |

---

## 8. Exceptions

Allowed only if all are true:

1. Clear user harm to fix (crash, privacy, cannot start)
2. Marked **temporary** with an exit condition
3. Does not rewrite the main-loop narrative

Exception without exit = permanent drift.

---

## 9. One-line reset

> **Are we helping them understand a bit more English—or complete another study task?**

If the latter, stop and redesign.
