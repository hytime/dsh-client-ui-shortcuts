# Mod Removal Tests Report

## Failure classification

- Profile registry: built-in/default global bindings and canonical normalization still expected `Mod`; legacy input migration needed explicit Meta output assertions.
- Host settings: legal modifier and persisted settings cases still encoded `Mod`, including the compatibility path and combined `Mod+Ctrl` input.
- Browser reserved: symbolic browser bindings used `Mod` fixtures, so production's explicit Meta matching returned no diagnostics.
- Keyboard router/resolve: names and fixtures described the removed platform fallback; physical Meta/Ctrl matching behavior was retained.
- Editor/settings card/visuals: controls, keycap labels, browser-reserved conflict expectations, and cross-platform conflict cases referenced the old virtual modifier.
- README English/Chinese: shortcut tables still displayed `Mod` instead of the explicit physical modifier contract.

## Migration strategy

- Updated normal configuration and test fixtures to use only `Meta`, `Ctrl`, `Alt`, and `Shift`.
- Kept compatibility tests for legacy persisted `Mod` input, asserting normalization behavior without treating `Mod` as a public output modifier.
- Updated presentation assertions: Meta is Command on macOS and Windows key elsewhere; Ctrl is Control on all platforms; macOS Alt is Option.
- Preserved question/custom save/action navigation, raw key, capture/editable, chord, and physical matching behavior. No production source was changed.

## Verification

- `CI=true pnpm exec vitest run --dir tests`: passed, 16 files / 225 tests.
- `CI=true pnpm run typecheck`: passed.
- `git diff --check`: passed.
- `CI=true pnpm run bundle`: passed.

## Commit

- Message: `test: align shortcut suite with physical modifiers`
- Hash: `4789be98fe0d35990f01c2b3a696dbf65f577a1b`
