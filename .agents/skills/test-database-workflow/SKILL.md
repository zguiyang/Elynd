---
name: test-database-workflow
description: >-
  Use for integration or functional tests, test databases, test migrations, seeds, SQL writes, or test cleanup; do not use for pure unit tests, read-only development-environment investigation, or ordinary code changes without database access.
---

# Test database workflow

Use this workflow for any test or AI action that can write to a database.

## Preflight

1. Read [`apps/backend/.env.test.example`](../../../apps/backend/.env.test.example) and the actual test configuration.
2. Confirm `TEST_DATABASE_URL` is present and its database name is exactly `gloaming_test`.
3. If the variable is missing or the target is unclear, stop. Never fall back to `DATABASE_URL` or `gloaming_backend`.

## Test boundary

- Pure unit tests use mocks and do not need this workflow.
- Integration and functional tests use `TEST_DATABASE_URL`; apply the test schema with `pnpm db:migrate:test` when required.
- Manual development verification is read-only by default. Database writes require the test database or explicit user approval.

## Safe data lifecycle

- Use unique prefixes for records created by a test.
- Track every created ID and clean up only those IDs in scoped teardown; never truncate or issue unscoped deletes.
- Check the shared test wiring in [`apps/backend/tests/setup.ts`](../../../apps/backend/tests/setup.ts) and [`apps/backend/src/lib/env.ts`](../../../apps/backend/src/lib/env.ts).

Functional test examples live in [`apps/backend/tests/functional/`](../../../apps/backend/tests/functional/); command entry points are in [`package.json`](../../../package.json).
