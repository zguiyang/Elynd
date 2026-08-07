# Elynd MVP Scope & Module Map

Defines **what we build first**, what we explicitly defer, and how product spaces map to prototypes and likely app surfaces.

Related: [`product-vision.md`](./product-vision.md) · [`success-metrics.md`](./success-metrics.md) · [`feature-decision-guide.md`](./feature-decision-guide.md) · [`prototype-flows.md`](./prototype-flows.md)

---

## 1. Current engineering reality

The stack is Adonis (`apps/backend`) + Next (`apps/web`). The first **working** product loop today is roughly:

**Sign-up / sign-in (cookie session) / Dashboard**

Learning-domain features (Library, Learning Room, Practice, Review, Progress) are still migrating or not yet rebuilt. This document is the **product target** for that rebuild—not a claim that all of it already ships.

---

## 2. MVP definition (first learning closed loop)

**MVP success:** A signed-in adult can, in one sitting of about **5–20 minutes**:

1. Open or resume a piece of English content at a manageable level
2. Read (and optionally listen) with on-demand comprehension help
3. Optionally do a **short** post-reading check grounded in that text
4. See that something can be **re-met later** (even a minimal Review stub)
5. Leave without shame—and want to return tomorrow

Auth + empty dashboard alone is **infra MVP**, not learning MVP.

### MVP in (must)

| Capability         | Notes                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Auth session       | Already in progress; keep cookie session model                                                  |
| Content access     | At least a small curated set (graded or leveled); one “current” text                            |
| Learning Room      | Read + tap/select assist; optional TTS listen                                                   |
| Light Practice     | 1–3 understanding checks **after** reading that text                                            |
| Review stub        | List of expressions/sentences from recent reading to re-meet (scheduling can be naive at first) |
| Progress stub      | Minutes / items / streak **without** shame UX                                                   |
| AI assist (narrow) | Explain word/sentence **in current text**; degrade if AI unavailable                            |

### MVP out (explicit non-goals)

| Non-goal                            | Why                                                 |
| ----------------------------------- | --------------------------------------------------- |
| Full course syllabus / lesson tree  | Course identity                                     |
| Free-topic AI chat as home          | Chatbot identity                                    |
| Public leaderboards / shame streaks | Willpower contest                                   |
| Heavy SRS vocab product             | Becomes Anki                                        |
| Social feed                         | Distraction from input loop                         |
| Multi-language product UI i18n      | Premature; docs stay English                        |
| Production marketing site in Next   | Landing HTML in `prd/` is enough until brand freeze |
| Perfect spacing algorithm           | Naive re-meet first; tune later                     |
| User-generated content marketplace  | Content/ops complexity                              |

---

## 3. Phased roadmap (sketch)

| Phase                   | Outcome                                                      | Exit criteria                                                              |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **P0 — Platform**       | Auth, app shell, env, DB                                     | Sign-in → dashboard stable                                                 |
| **P1 — Input loop**     | Library (minimal) + Learning Room + assist (+ TTS if ready)  | User completes one read session with help                                  |
| **P2 — Close the loop** | Practice + Review stub + Progress stub                       | Same text can be practiced and re-met; habit visible                       |
| **P3 — Depth**          | Better leveling, Review scheduling, content pipeline, polish | Metrics in [`success-metrics.md`](./success-metrics.md) move the right way |
| **P4 — Later**          | Grounded dialogue, richer library, marketing web             | Only if P1–P2 philosophy still holds                                       |

Do not start P4 identity features (chat home, courses) to “fill the roadmap.”

---

## 4. Module map (product ↔ prototype ↔ likely code)

| Product space   | Role in loop               | Prototype (`prd/`)       | Likely home (when built)                    |
| --------------- | -------------------------- | ------------------------ | ------------------------------------------- |
| Marketing story | Philosophy-first landing   | `elynd-landing-v1.html`  | Future `apps/web` marketing routes (not P1) |
| Dashboard       | Entry after auth           | `dashboard.html`         | `apps/web` app shell / home                 |
| Library         | Discover / pick content    | `elynd-library-v1.html`  | `apps/web/features/**` + API content module |
| Learning Room   | Read / listen / assist     | `learning-room-v1.html`  | Core learning feature + API                 |
| Practice        | Post-input checks          | `elynd-practice-v1.html` | Feature after Learning Room                 |
| Review          | Re-meet                    | `elynd-review-v2.html`   | Feature + scheduling later                  |
| Progress        | Habit / time-with-language | `elynd-progress-v1.html` | Lightweight stats UI                        |

Prototypes are **intent and UX direction**, not pixel-perfect specs. Implementation must still pass [`design-guardrails.md`](./design-guardrails.md).

---

## 5. Content strategy (MVP-level)

**Full SSOT:** [`content-strategy.md`](./content-strategy.md) (scope, processing, admin/learner flows, first validation titles).

| Topic       | MVP stance                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Source      | Fixed curated library; team-owned or clearly licensed; **no** scrape pipeline                       |
| Genres      | Short narrative / modernized fable + light situational-in-story; **no** meme/joke pack in first set |
| Unit        | One short article ≈ one session; no chapter syllabus                                                |
| Volume      | Lean validation set (~5 polished pieces) first; expand only after the loop proves itself            |
| Leveling    | Coarse bands (e.g. easy / mid / stretch); refine with coverage metrics later                        |
| Ops         | Admin-only CMS (draft → publish); learners never edit the catalog                                   |
| User import | Defer until curated loop works                                                                      |

Without content, Learning Room is an empty room—treat seeding the validation set as part of P1, not an afterthought. Do **not** bulk-write articles before that module is in active development.

---

## 6. AI / privacy / cost (MVP constraints)

- AI only for **in-text** assistance and optional practice generation from that text
- **Degrade path:** reading + basic glossary (static or cached) if AI fails
- Do not send more context than needed; no “always-on companion chat” in MVP
- Cost: prefer short prompts tied to selection/sentence, not whole-library RAG theater

---

## 7. How to use this doc in planning

1. Pick a phase (P0–P2 for near-term)
2. Confirm the feature is **in** MVP or explicitly **later**
3. Run [`feature-decision-guide.md`](./feature-decision-guide.md) four questions
4. Walk [`design-guardrails.md`](./design-guardrails.md) before merge
5. Attach metrics from [`success-metrics.md`](./success-metrics.md)

If a proposal is exciting but outside MVP and fails the philosophy tests, park it.
