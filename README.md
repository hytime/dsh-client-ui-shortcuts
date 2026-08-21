# DSH Client UI Shortcuts

English | [中文](README.zh.md)

`@hytime/dsh-client-ui-shortcuts` is an independent DeepSeek Harness Web Client plugin. It adds profile-aware keyboard controls and a settings card for pending question and approval interactions without changing DSH core, the agent loop, or the model protocol.

## What it provides

- `standard` and `vim` keyboard profiles, with `standard` active by default.
- Arrow-key, `j`/`k`, Enter, and Escape handling for question and approval surfaces.
- Single-select, multi-select, custom-answer, skip, and submit flows for questions.
- Allow-once, reject, and session-scoped cancel actions for approvals.
- A settings card backed by the `dsh-ui-shortcuts` settings namespace.
- One active profile at a time; unknown or removed profiles never become active.

## Package contract

| Item | Value |
| --- | --- |
| Package | `@hytime/dsh-client-ui-shortcuts` |
| Bundle row | `dsh-ui-shortcuts` |
| Settings namespace | `dsh-ui-shortcuts` |
| Persisted field | `activeProfile` |
| Locale namespace | `dsh-shortcuts` |
| Built-in profiles | `standard`, `vim` |
| Browser entry | `lib/client.js` |

The package contributes a Host settings namespace and a Client plugin. Its `cordis.patch.yml` inserts the `dsh-ui-shortcuts` bundle row; DSH Web supplies the surrounding Web runtime and Client module roster.

## Installation

Install or upgrade the plugin in a DSH profile only through the DSH CLI:

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.4
```

See the [installation guide](docs/installation.md) for DSH CLI installation, local tarball installation, profile verification, upgrades, and troubleshooting. Do not use `npm install`, `pnpm add`, or direct edits to a DSH profile's `package.json` or lockfile. See the [changelog](CHANGELOG.md) for release history and the [Chinese changelog](CHANGELOG.zh.md) for the translated version.

The browser artifact is a DSH lazy-CJS loader factory. Do not open the `apps/web` Vite entry directly to validate this plugin; it requires DSH boot injection and a real Web composition.

## Development

These `pnpm` commands are for developing this package only; consumers must install the published or packed plugin through `dsh plugin --profile <name> add ...`.

```bash
pnpm install
pnpm run bundle
pnpm run typecheck
pnpm exec vitest run tests
```

`pnpm run bundle` emits the Node library, declarations, browser `lib/client.js`, and its source map. The browser bundle keeps DSH platform modules external, rejects ordinary non-platform `@deepseek-ai/*` runtime imports, compiles CSS Modules with Lightning CSS, and inlines local Iconify data.

## Architecture boundaries

The dependency direction is:

```text
contract -> profiles/keyboard -> settings/components -> apply
```

`src/client/apply.ts` is the Client assembly point. React components receive plain props and callbacks; they do not receive Cordis context, runtime services, or module-level singleton stores. Slot, locale, settings-controller, and style registrations are owned by the current Client fiber and are disposed with it.

The package uses these DSH extension points:

- `conversation.composer` for question and approval takeover.
- `settings.plugin.item` for the profile settings card.
- Client locale registration for `dsh-shortcuts` dictionaries.
- Host settings registration for `dsh-ui-shortcuts`.

## Model Experience

None, as this package changes browser interaction only. It does not add prompt sections, tools, model-visible events, or model request context.

#### KV Cache effect

None; the package does not assemble or send a model request.

## Known Limitations and Deferred Work

- The copied `clientBundle` configuration must be kept aligned with the DSH loader, external-module, and CSS injection contracts used by the target DSH release.
- Full browser activation requires a DSH Web composition with matching peer packages and boot data; the package is not a standalone React or Vite application.
- The package currently provides the built-in `standard` and `vim` profiles. Adding another profile requires registering its data and locale keys through the Client plugin contract.
