# Git Commit Rules

This document defines the git commit rules for the Elynd project.

## Core Rules

- Commit messages must be written in English.
- Commit messages must use Conventional Commits.
- Use the `git-commit` skill when it is available.
- Do not add a commit body or detailed description unless it is necessary for clarity.
- One commit must contain exactly one logical change.
- Complete minimal verification before creating a commit.
- Do not commit unrelated files, temporary debug code, credentials, secrets, or generated noise.
- Do not push code to any remote repository without the user's explicit approval.

## Conventional Commit Format

Use the following format:

```text
<type>(<scope>): <description>
```

Examples:

```text
fix(backend): add missing book chat prompt template
feat(web): add chapter vocabulary panel
refactor(auth): simplify token lookup flow
test(books): cover empty chapter response
docs(rules): add git commit guidelines
```

## Message Style

- Keep the subject concise and specific.
- Use imperative mood, such as `add`, `fix`, `refactor`, or `remove`.
- Keep the subject focused on the outcome, not the implementation details.
- Do not add a detailed commit body unless one of the following is true:
  - the change has an important constraint or tradeoff
  - the change affects multiple subsystems in one logical unit
  - the reviewer needs extra context to understand why the change exists

## Type Boundaries

Use commit types consistently:

- `feat`: a new user-facing or developer-facing capability
- `fix`: a bug fix or regression fix
- `refactor`: structural improvement without changing intended behavior
- `test`: adding or improving tests without changing production behavior
- `docs`: documentation-only changes
- `chore`: maintenance work that does not fit the categories above

Do not mix multiple unrelated types into a single commit.

## Scope Rules

Use a scope when it improves clarity. Prefer short, stable, domain-oriented names.

Recommended scopes include:

- `backend`
- `web`
- `auth`
- `books`
- `reader`
- `admin`
- `rules`
- `infra`

Choose the narrowest scope that still makes sense to someone reading history later.

## Commit Boundaries

Each commit must represent one logical change. A logical change can include code, tests, and documentation only when they belong to the same behavior or fix.

Examples of a valid single logical change:

- fixing a backend bug and adding the test that proves the fix
- adding a new frontend feature and updating the related documentation
- refactoring one module and adjusting tests to preserve behavior

Examples that must be split:

- a bug fix plus an unrelated UI cleanup
- a new feature plus a refactor in a different subsystem
- documentation cleanup mixed with production code changes that are not part of the same logical unit

## Multiple Commits vs Squash

Multiple commits are allowed when they improve reviewability within the same change stream.

Good reasons to use multiple commits:

- one commit introduces a refactor required by a later feature commit
- one commit adds failing or supporting tests and a later commit implements the fix
- one commit updates shared infrastructure and later commits apply it in isolated areas

Prefer squash before final integration when intermediate commits are noisy, partial, or only useful during development.

Commits should be squashed when they mainly contain:

- fixup work
- typo corrections in code created moments earlier
- local iteration noise
- temporary instrumentation that is later removed

## Minimal Verification Before Commit

At minimum, run the smallest relevant verification for the changed area before committing.

Examples:

- run the relevant unit test for a small backend bug fix
- run the relevant lint or typecheck command for a frontend change
- run the directly affected test file for a prompt or service update

If broader verification is not run, state that clearly when reporting the work.

## Forbidden Content

Never commit any of the following:

- unrelated modified files
- temporary debug logs or commented-out debug code
- experimental throwaway files
- secrets, tokens, keys, `.env` values, or credential material
- local machine artifacts that do not belong in version control

Before committing, review the staged diff and confirm that every file belongs to the same logical change.
