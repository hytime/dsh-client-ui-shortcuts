# Mod Removal Report

## Migration strategy

- Public modifier types and persisted canonical modifiers now contain only `Meta`, `Ctrl`, `Alt`, and `Shift`.
- Legacy persisted `Mod` values are accepted only at read/normalization boundaries and converted to `Meta`.
- Built-in and default settings bindings persist explicit `Meta` combinations. Serialization never emits `Mod`.
- Resolver matching is physical and platform-independent: `Meta` matches only `metaKey`; `Ctrl` matches only `ctrlKey`.
- Platform affects presentation only: Meta renders Command on macOS and Windows key elsewhere, Ctrl renders Control on every platform, and macOS Alt renders Option.
- Editor recording writes Meta/Ctrl/Alt/Shift and exposes only those four checkbox controls.

## Host event chain

`ctx.settings.update('dsh-ui-shortcuts', patch)` enters the DSH `SettingsProvider` write queue. The provider resolves and validates the candidate, persists the raw user section, commits the resolved value, and then emits `settings/updated(ns, next, prev, source)`. The package Host apply listens to that event, filters `dsh-ui-shortcuts`, normalizes `next.customBindings` with `normalizePersistedShortcutResult(...).bindings`, and performs one scoped update when the resolved value still contains legacy `Mod`. A reentrancy guard prevents the normalization update's second event from starting another migration. The listener is owned by the package fiber through `ctx.on`, so disposal removes it.

The previous `settings.update` monkey patch was removed because the provider's internal write path persists its own raw section and does not use an overridden method for the actual commit/persist flow.

## RED/GREEN

- Initial focused run: 2 Host settings failures. MemorySettings recorded raw persisted sections containing `Mod` for both plain legacy input and `Mod + Ctrl` input.
- GREEN: after switching to `settings/updated` event migration and waiting for the asynchronous scoped write, focused Host tests passed: 29/29.
- The legacy migration unit test remains and asserts `Mod + Alt` normalizes to `Meta + Alt`.
- Host persistence tests assert the final persisted section and `ctx.settings.get()` contain no `Mod`, and assert `Mod + Ctrl` becomes `Ctrl + Meta` according to the normalizer's canonical ordering.

## Verification

- `CI=true pnpm exec vitest run --dir tests host-settings.spec.ts package-shape.spec.ts profile-registry.client.spec.ts`: passed, 56 tests.
- `CI=true pnpm exec vitest run --dir tests`: passed, 226 tests.
- `CI=true pnpm run typecheck`: blocked by an existing unrelated error in `src/client/keyboard/conflicts.ts:12`: `Cannot find name 'ShortcutPlatform'`.
- `git diff --check`: passed.
- Hash before final commit: `e8dea05af8a6b52b4e76ed40a6dd153e672ce7c2`.

## Commit

Pending: `fix: persist migrated Meta shortcut bindings`

Hash: `8fcf3f76a3d55ccceab90c631e9aec1a159db028`
