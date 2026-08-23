# Question Description Repair Report

Status: COMMITTED

## Root cause

`QuestionFlow` already rendered the top-level `question.detail`, but option buttons rendered only `option.label`. The DSH question option shape supports `description`, so the information was present in the payload and lost only at presentation.

## TDD evidence

- Baseline: `CI=true pnpm exec vitest run --dir tests composer.client.spec.tsx` passed 26 tests.
- Added a regression test with both top-level detail and option descriptions.
- RED: the focused suite failed because `Option A details` was absent from the rendered card.
- GREEN: the focused suite passed after the minimal JSX/CSS change.

## Changes

- Kept `question.detail` rendering unchanged.
- Rendered each `option.description` below its label without changing answer selection or response payloads.
- Added flex column option content styling, tertiary token color, `pre-wrap`, and `overflow-wrap` for wrapping and mobile layouts.
- Retained existing keyboard and submission coverage.

## Verification

- `CI=true pnpm exec vitest run --dir tests composer.client.spec.tsx`: 27 passed.
- `CI=true pnpm exec vitest run --dir tests`: 16 files, 222 passed.
- `CI=true pnpm run typecheck`: passed.
- `git diff --check`: passed.

## Commit

Committed as `09fdd00bf7fa5f5ad0744f5c05e305eff97f39e5`.
