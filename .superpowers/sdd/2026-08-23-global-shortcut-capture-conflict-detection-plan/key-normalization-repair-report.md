# Keyboard Normalization Repair Report

## Root Cause

macOS Option+Shift+N produces `KeyboardEvent.key` as the layout-dependent character `˜`, while the physical `KeyboardEvent.code` remains `KeyN`. The global router passed the raw key through normalization, and resolver exact/prefix comparisons therefore compared `˜` against the configured logical key `n`. `KeyInput` also had no physical code field.

## RED / GREEN

RED was confirmed before the production fix with the requested keyboard tests. The new cases failed for the expected functional reason: physical `KeyN`/`Digit0` were not mapped, and the macOS `startSession` exact and `nextSession` prefix routes did not dispatch. The initial test insertion had a syntax error, which was corrected before the functional RED run.

GREEN was confirmed after the minimal fix:

- `KeyA`-`KeyZ` map to lowercase logical keys.
- `Digit0`-`Digit9` map to their digit keys.
- Missing or unsupported `code` falls back to the existing raw-key normalization.
- `KeyInput.code` is optional, preserving hand-built question/approval inputs and existing callers.
- Existing resolver exact/prefix behavior consumes the normalized logical key; diagnostic raw-key semantics are unchanged because no diagnostic raw key field was altered.

## Modified Files

- `src/client/contract/keyboard.ts`: added optional `KeyInput.code`.
- `src/client/keyboard/normalize.ts`: read `event.code`, derive logical keys from supported physical codes, and preserve fallback behavior.
- `tests/keyboard-resolve.client.spec.ts`: added letter code, digit code, no-code fallback, and ordinary-key regression tests.
- `tests/keyboard-router.client.spec.ts`: added macOS `KeyN` exact `startSession` and `KeyK` prefix `nextSession` regressions with raw `˜`.

No DSH action API, browser denylist, or capture lifecycle changes were made.

## Verification

- `CI=true pnpm exec vitest run --dir tests keyboard-resolve.client.spec.ts keyboard-router.client.spec.ts keyboard-visuals.client.spec.ts`: 3 files passed, 49 tests passed.
- `CI=true pnpm exec vitest run --dir tests`: 16 files passed, 216 tests passed.
- `CI=true pnpm run typecheck`: passed with exit code 0.
- `git diff --check`: passed with no output.

## Commit

Commit message: `fix: normalize shortcut keys from physical codes`

Commit hash: 246d05a027b212edb319f012ec56af777627c895
