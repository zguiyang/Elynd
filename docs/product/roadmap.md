# Gloaming Roadmap

Three phases. **Outcomes only**—do not pre-design future features.

V1 feature specification: [`mvp-scope.md`](./mvp-scope.md). Domain model: ADR-001 [`../adr/001-reading-content-domain-model.md`](../adr/001-reading-content-domain-model.md).

---

## Phase 1 — Language reading environment

**Outcome:** Gloaming is a place you open to **continue authentic English**, with contextual AI that unsticks you on the page, then disappears.

**Module roadmap (anti-drift):** [`mvp-1-modules.md`](./mvp-1-modules.md).

| Slice          | Outcome                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1a (MVP 1)** | **Admin EPUB catalog pipeline:** upload → process chapters → publish **ReadingWork** → **发现** → **我的书架** → Reader with help / translate / TTS. **No user upload.** |
| **1b**         | **User import** (EPUB/PDF/web, etc.); `用户` source on shelf; same Work/Part model                                                                                       |

```text
Admin EPUB upload
  → Processing
  → ReadingWork + ReadingPart[]
  → Publish
  → Discover
  → Shelf
  → Reader
  → AI Assist
```

Exit Phase 1 when 1a is real for users and 1b is either shipped or explicitly deferred without blocking daily reading. Do not ask users to practice, review, or chat.

Capability must / must-not: [`mvp-scope.md`](./mvp-scope.md).

**Wording:** say **no user upload in MVP 1** — not “no EPUB in MVP” (admin EPUB is in MVP).

---

## Phase 2 — AI reading companion

**Outcome:** Help inside the book feels like a **companion for this text**, not a generic chatbot parked beside a page.

Do not spec Phase 2 surfaces yet. Start Phase 2 only after Phase 1 is actually used as a reading environment.

---

## Phase 3 — Reading-based language growth

**Outcome:** Growth is visible as **time and depth with real English**, not as a study system bolted on.

Do not spec SRS, speaking, or dashboards here. If anything appears later, it must still serve reading. It must not become the reason to open Gloaming.

---

## Rules for this document

- Do not add a Phase 4 of “everything competitors ship.”
- Do not turn Phase 2/3 into a backlog of modules.
- A feature that would make Phase 1 a worse reading environment is not a Phase 2 sneak-peek; it is a cut.

---

## Revision log

| Date       | Change                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| 2026-08-24 | Phase 1a = admin EPUB pipeline; 1b = user import only; ADR-001 alignment. |
