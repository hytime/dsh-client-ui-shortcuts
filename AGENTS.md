# `@hytime/dsh-client-ui-shortcuts` package rules

## Ownership and dependency direction

This repository owns the independent package `@hytime/dsh-client-ui-shortcuts`. Profile ids such as `standard` and `vim` are data values and must not become package names. The package extends DSH through its declared Client plugin and does not modify DSH core.

Keep public Client types in `src/client/contract`. Keep `src/client/apply.ts` as the only cross-domain assembly point. Dependencies flow from `contract` to `profiles`/`keyboard`, then to `settings`/`components`, and finally to `apply`. React components receive plain props and callbacks; they do not receive `ctx`, Cordis services, or module-level singleton stores.

## Client implementation

Use DSH primitives, CSS Modules, and semantic `--dsw-*` tokens. Import Iconify local icon objects on demand; do not use a runtime network provider or Iconify API. The browser artifact is a lazy-CJS DSH loader factory at `lib/client.js`. Ordinary `@deepseek-ai/*` value imports are rejected by bundle purity checks, while platform externals reuse the DSH runtime instances.

The package maintains a copied `clientBundle` configuration because DSH does not publish that preset as a stable package API. Keep the copy aligned with the current DSH checkout rather than expanding the DSH framework surface.

## Checks and integration

Run the smallest relevant checks after changes:

```bash
CI=true pnpm exec vitest run tests/invariant.client.spec.ts
CI=true pnpm run typecheck
git diff --check
```

For browser integration, build with `pnpm run bundle` and load the installed package through a real DSH composition. Do not validate this package by opening the `apps/web` Vite entry directly; it requires DSH boot injection. The official DSH architecture and extension guidance are in the local checkout at `/Volumes/hydisk/deepseek-harness/docs/architecture.md`, `/Volumes/hydisk/deepseek-harness/docs/cookbook/extension-cookbook.md`, and `/Volumes/hydisk/deepseek-harness/docs/cookbook/adding-a-package.md`.

## Local-only materials

`docs/superpowers/` and `.superpowers/` contain local planning material and must remain ignored. Do not submit their contents.
