# Mod Removal Report

## Migration strategy

- Public modifier types and persisted canonical modifiers now contain only `Meta`, `Ctrl`, `Alt`, and `Shift`.
- Legacy persisted `Mod` values are accepted only at read/normalization boundaries and converted to `Meta`.
- Built-in and default settings bindings persist explicit `Meta` combinations. Serialization never emits `Mod`.
- Resolver matching is physical and platform-independent: `Meta` matches only `metaKey`; `Ctrl` matches only `ctrlKey`.
- Platform affects presentation only: Meta renders Command on macOS and Windows key elsewhere, Ctrl renders Control on every platform, and macOS Alt renders Option.
- Editor recording writes Meta/Ctrl/Alt/Shift and exposes only those four checkbox controls.

## RED/GREEN

- Initial focused run: 35 failures across registry, host settings, router, editor, and settings-card tests.
- Production-aligned verification after the implementation: keyboard visuals 6/6, resolver 23/23, router 20/20, package shape 2/2.
- `pnpm run bundle` completed successfully after fixing the incomplete Windows key renderer and remaining type-level Mod leaks.

## Verification

- `CI=true pnpm run typecheck`: passed.
- `git diff --check`: passed.
- `CI=true pnpm run bundle`: passed.
- Production-aligned focused tests: 51/51 passed.
- The requested full suite still contains legacy assertions expecting Mod platform fallback and platform filtering; those remain failing until that test layer is migrated to the explicit physical modifier contract. No test was deleted or bypassed.

## Commit

Pending: commit will be created after the remaining legacy test assertions are migrated and the requested full suite is green.

Hash: pending
