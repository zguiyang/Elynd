---
name: repository-structure
description: >-
  Use when adding, deleting, splitting, moving, or promoting files, modules, or shared code, or when an apps/web/features UI file exceeds 500 lines; do not use for ordinary bug fixes, copy or style edits, pure logic tweaks, or abstraction proposals based only on hypothetical reuse.
---

# Repository structure

Make the smallest structural change supported by actual consumers and neighboring project conventions.

## Decide the shape

- Merge into an existing file when the role already exists; inline a one-consumer helper instead of creating a file.
- Create a file or shared location only for two or more real consumers, or when framework layout requires it. Do not create parallel types or unnecessary wrapper layers.
- Split mixed concerns by concern. A cohesive file is not split for line count alone, but UI files under [`apps/web/features/`](../../../apps/web/features/) over 500 lines must split into colocated UI concerns and keep the page as orchestrator.
- Promote code only when at least two modules consume it; keep one-module code colocated.

## Verify structure changes

- Before deleting, check callers, tests, and exports; update remaining references and remove dangling barrels.
- For environment configuration, validate related values at boot or one config entry; do not add one wrapper module per variable.
- Keep directories flat by default and name them by domain or concern rather than artifact type.

The always-on structural boundary is [`structure.mdc`](../../../.cursor/rules/structure.mdc); use it together with the actual neighboring files before changing layout.
