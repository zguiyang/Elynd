# Elynd Success Metrics

What we measure so building stays honest. Numbers serve the philosophy—they do not replace it.

Related: [`product-vision.md`](./product-vision.md) · [`mvp-scope.md`](./mvp-scope.md) · [`design-guardrails.md`](./design-guardrails.md)

---

## 1. North star

> **Weekly minutes of engaged reading/listening of leveled English content per active learner.**

“Engaged” means time in Learning Room (or equivalent) with the text, not idle tab time. Refine instrumentation later; keep the intent fixed.

If this rises while shame, chat-as-home, or task-without-reading also rise, **north star is not enough**—check drift metrics.

---

## 2. Product metrics (prefer these)

| Metric                               | Why it matters                            | MVP note                                                                |
| ------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------- |
| Weekly reading/listening minutes     | Directly tracks comprehensible-input time | Instrument ASAP in P1                                                   |
| Sessions started per week            | Low startup friction                      | Count Learning Room opens with content                                  |
| Session completion (short path done) | 5–20 min “complete” feeling               | Define completion = reached end or explicit “done for today”            |
| Texts finished or deeply sampled     | Meaningful exposure                       | “Deep sample” = scrolled/read past a threshold + ≥1 assist or N minutes |
| Assist usage rate (per session)      | Friction relief without replacing reading | Watch for assist-only sessions with no reading progress                 |
| Practice completion **after** a text | Output after input                        | Denominator = texts with practice available                             |
| Review return rate (7-day)           | Re-meeting works                          | Even naive Review should see returns                                    |
| D1 / D7 return (learning days)       | Habit forming                             | Learning day = had a content session, not only login                    |

---

## 3. Drift / vanity metrics (watch or de-prioritize)

| Metric                         | Risk if optimized blindly       |
| ------------------------------ | ------------------------------- |
| AI chat turns                  | Can rise while reading falls    |
| Feature click counts           | Menu tourism                    |
| Streak length alone            | Encourages shame mechanics      |
| Words “memorized”              | Pulls toward vocab-app identity |
| Time in app (undifferentiated) | Includes settings/chat fluff    |
| “Engagement” without content   | Growth theater                  |

**Rule:** If a metric can go up while north-star minutes go down, do not use it as a primary success signal.

---

## 4. Qualitative checks (still required)

Ship reviews should still answer:

1. Did first success feel like **understood a bit of English**—or finished a chore?
2. Would a Shawney/Kaufmann-minded user recognize an **input-first** product?
3. With AI off, is the core path still respectful?

---

## 5. Phase targets (directional, not contracts)

| Phase | Signal we care about                                              |
| ----- | ----------------------------------------------------------------- |
| P1    | Users can complete a helped read session; minutes logged          |
| P2    | Same users return within 7 days; Review opened at least once      |
| P3    | Weekly minutes trend up without rising shame/chat-home complaints |

Exact numeric OKRs can wait until instrumentation exists—**do not invent fake targets** before events fire.

---

## 6. Experiment guardrail

Any A/B or growth experiment must declare:

- **Primary:** a product metric from §2 (ideally north star or sessions + minutes)
- **Guardrail:** at least one drift check (e.g. reading minutes must not fall; chat turns must not replace Learning Room time)

If primary wins and guardrail loses → do not ship.
