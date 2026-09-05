# ADR-002: T1 Architecture Contract Facts

**Status:** Accepted for T1
**Date:** 2026-09-05
**Scope:** Persistence facts and shared contracts only

This record makes the T1 persistence facts explicit without implementing backend
workflow, queue, retry, lease, or provider behavior.

## Decisions

- `ReadingState.revision` is a nonnegative compare-and-swap version, defaulting
  to `0` for existing and newly created rows.
- Reading completion remains monotonic; `restart` is the only explicit reset.
  A valid incoming position wins, while an absent position preserves the current
  position. Concurrent first-create attempts keep the row that wins the existing
  `(user_id, work_id)` unique constraint.
- `ContentAsset.generationKey` identifies `(part_id, audio kind, content hash)`.
  Existing audio assets are backfilled with that identity. The nullable partial
  unique index preserves non-audio and legacy rows while preventing duplicate
  generation identities.
- `generationToken`, claim time, and lease expiry are nullable backend-owned
  facts. Non-null tokens are unique and nonempty; shared code exposes only the
  value/schema shape, not lease or provider implementation.
- The shared package owns enum values, derived types, Zod schemas, display maps,
  the stable generation-key helper, and the reader merge rule. ORM and runtime
  workflow remain outside shared.

## ARC mapping

| T1 fact                                                                                              | ARC mapping      |
| ---------------------------------------------------------------------------------------------------- | ---------------- |
| ReadingWork/ReadingPart/ReadingState/ContentAsset remain the only content entities                   | ARC-001, ARC-002 |
| `reading_state.revision`, completion/position constants, and `(user_id, work_id)` conflict semantics | ARC-002, ARC-008 |
| `content_asset.generation_key` backfill and nullable partial uniqueness                              | ARC-003, ARC-010 |
| `generation_token`, claim/lease timestamps, and nonempty/unique constraints                          | ARC-004, ARC-010 |
| Shared Zod/value/display contracts and stable key helper                                             | ARC-008          |
| Backend-only ownership of claim, lease, retry, queue, and provider workflow                          | ARC-004, ARC-014 |

## Consequences

T2 can implement one DB-backed generation claim using `generationKey` and a
stable token without changing the public domain model. T3 can use `revision` and
the shared merge constants when implementing state updates. Later T7 work must
include these migration facts in any export, fixture, or migration verification;
no runtime routes or consumers are changed by T1.
