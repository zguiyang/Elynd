# AdonisJS v7 Upgrade Execution Report

Date: 2026-03-19

## Summary

AdonisJS v6->v7 convergence is completed on top of the existing partial upgrade state.
The goal of preserving backend API contracts and web compatibility has been met.

## Key Changes

- Upgraded backend Adonis ecosystem to v7-compatible package versions.
- Replaced TypeScript JIT runtime with `@poppinss/ts-exec` in `backend/ace.js`.
- Added `youch` as dev dependency.
- Added v7 hooks and updated test glob patterns in `backend/adonisrc.ts`.
- Migrated encryption config to `backend/config/encryption.ts` and removed `appKey` export from `backend/config/app.ts`.
- Added required subpath imports: `#generated/*` and `#transformers/*` in backend `package.json`.
- Stabilized runtime dependencies: added `mqtt` and upgraded `adonisjs-jobs` to `^0.2.0`.
- Synced lockfile with current backend package state.

## Verification Results

- `pnpm --filter backend build`: passed
- `pnpm --filter backend typecheck`: passed
- `pnpm --filter backend test`: passed (111/111)
- `pnpm --filter backend dev`: startup passed

- `pnpm --filter web typecheck`: passed
- `pnpm --filter web test`: passed (53/53)
- `pnpm --filter web build`: passed
- `pnpm --filter web dev`: startup passed

## E2E Smoke

- `POST /api/auth/register` -> 200
- `POST /api/auth/login` -> 200
- `GET /api/books` -> 200

## Not Applicable Items

- Inertia/Tuyau/Bouncer migration items (not used in this repo)
- Legacy helper replacements, Request/Response renames, flash `errors` key migration (no matching usage found)
