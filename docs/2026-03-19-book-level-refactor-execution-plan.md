# Book Level Refactor Execution Plan (MVP, No Runtime Compatibility)

## Objective
Replace legacy `books.difficulty_level` string semantics with a normalized `book_levels` table and `books.level_id` foreign key, while introducing AI-assisted level classification during book import.

## Compatibility Boundary
- Runtime compatibility with `difficulty` / `difficultyLevel` is intentionally removed.
- Only one compatibility path is preserved: one-time data migration from legacy stored values to new levels.

## Phase Checklist

### Phase A — Schema & Data Migration
- [x] Create `book_levels` table.
- [x] Add `books.level_id` and classification metadata fields.
- [x] Backfill `books.level_id` from legacy values (`L1/L2/L3`, `beginner/intermediate/advanced`).
- [x] Apply fallback mapping for unknown legacy values to the lowest level.
- [x] Add FK constraint `books.level_id -> book_levels.id` and set `NOT NULL`.
- [x] Drop legacy `books.difficulty_level` column.

Verification commands:
```bash
pnpm --filter backend exec node ace migration:run
```

Result record:
- Migration `20260319170000_refactor_book_difficulty_to_book_levels` applied successfully.
- `book_levels` table created and scanned by schema generator.

### Phase B — Backend Cutover
- [x] Replace `difficulty` filtering API with `levelId`.
- [x] Replace `difficultyLevel` update payload with `levelId`.
- [x] Add `BookLevel` model and `BookLevelService`.
- [x] Add `GET /api/book-levels` endpoint.
- [x] Return `level` object in learning/recommendation responses.
- [x] Remove code paths parsing `L1/L2/L3` with string replacement logic.

Verification commands:
```bash
pnpm run typecheck
pnpm run lint
```

Result record:
- Backend typecheck passed.
- Backend lint passed.

### Phase C — AI Level Classification
- [x] Add prompt template `book/level-classification.edge`.
- [x] Add `classifyBookLevel` method in semantic clean service.
- [x] Replace `assignDifficultyLevel` with `assignBookLevel` in import orchestrator.
- [x] Implement fallback classification to rule-based mapping when AI fails.
- [x] Persist `levelId`, `levelClassifiedBy`, and `levelClassifiedAt`.

Verification commands:
```bash
pnpm --filter backend test
```

Result record:
- Import-related unit tests passed after migration and contract updates.

### Phase D — Frontend Cutover
- [x] Replace `difficultyLevel` types with `level` object and `levelId`.
- [x] Replace list filtering query from `difficulty` to `levelId`.
- [x] Display `level.description` in learning views.
- [x] Load editable levels via `GET /api/book-levels` in admin edit dialog.

Verification commands:
```bash
pnpm --filter web typecheck
pnpm --filter web test
```

Result record:
- Web typecheck passed.
- Web tests passed (12 files, 53 tests).

### Phase E — Final Verification
- [x] Run monorepo typecheck.
- [x] Run monorepo lint.
- [x] Run backend test suite.
- [x] Run web test suite.

Verification commands:
```bash
pnpm run typecheck
pnpm run lint
pnpm --filter backend test
pnpm --filter web test
```

Result record:
- `typecheck`: passed
- `lint`: passed
- `backend test`: passed (111/111)
- `web test`: passed (53/53)

## Public Interface Changes
- Added: `GET /api/book-levels`
- Changed: `GET /api/books?levelId=...` (removed `difficulty`)
- Changed: `PATCH /api/admin/books/:id` payload now uses `levelId` (removed `difficultyLevel`)
- Changed: learning response shape now uses `level` object instead of `difficulty` string

## Notes for Review
- Existing tracked workspace change before this work: `pnpm-lock.yaml`.
- Generated file produced during migration/tests: `backend/database/schema.ts`.
- Migration and contract refactor intentionally remove runtime compatibility for legacy difficulty fields.
