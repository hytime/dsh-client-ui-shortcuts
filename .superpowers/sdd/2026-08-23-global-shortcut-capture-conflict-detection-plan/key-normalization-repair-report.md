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

## Follow-up: Hidden Platform Binding Conflict Review

### Root Cause

`findNewShortcutConflicts` filtered draft entries with `bindingPlatformCompatible`, but expanded every baseline binding. A baseline binding using an explicit modifier unavailable on the active platform therefore participated in cross-scope duplicate/prefix comparison and could block an otherwise valid save.

### TDD RED / GREEN

- RED: the new macOS regression failed because a hidden Ctrl baseline binding still blocked a visible Mod binding; Linux and Windows cases covered hidden Meta versus visible Ctrl, and visible conflict cases remained blocking.
- GREEN: baseline expansion now applies the same active-platform compatibility filter while retaining each binding's original index, preserving exact/prefix and baseline-exemption semantics.

### Regression Coverage

- Linux and Windows: hidden Meta binding versus visible Ctrl binding across scopes does not block saving.
- macOS: hidden Ctrl binding versus visible Mod binding across scopes does not block saving.
- Linux and macOS visible cross-scope duplicate conflicts remain blocked.
- Existing malformed-binding, browser-reserved, exact, prefix, and baseline-exemption behavior remains covered.

### Modified Files

- `src/client/keyboard/conflicts.ts`: filter platform-incompatible baseline bindings before cross-scope comparison.
- `tests/shortcut-binding-editor.client.spec.tsx`: add hidden-platform cross-scope save regressions and visible conflict regressions.

### Verification

- `CI=true pnpm exec vitest run --dir tests settings-card.client.spec.tsx shortcut-binding-editor.client.spec.tsx browser-reserved.client.spec.ts keyboard-resolve.client.spec.ts`: 4 files passed, 81 tests passed.
- `CI=true pnpm exec vitest run --dir tests`: 16 files passed, 220 tests passed.
- `CI=true pnpm run typecheck`: passed with exit code 0.
- `git diff --check`: passed with no output.

### Commit

Commit message: `fix: ignore hidden platform bindings in conflict checks`
