# DSH Client UI Shortcuts

[![npm version](https://img.shields.io/npm/v/%40hytime%2Fdsh-client-ui-shortcuts?logo=npm&label=npm)](https://www.npmjs.com/package/@hytime/dsh-client-ui-shortcuts) [![license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit/)

English | [中文](README.zh.md)

Profile-aware keyboard shortcuts and compact interaction cards for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web Client.

Use it when DSH asks you a question, requests approval, or needs a predictable keyboard workflow for repeated session work. The plugin stays inside DSH Web, follows the current conversation composer, and does not modify DSH core, the agent loop, or the model protocol.

## Install in 60 seconds

Install the plugin through the DSH CLI, then restart or reload the Web composition:

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.10
dsh --profile web
```

The plugin is not a standalone React or Vite application. Do not open `apps/web` directly and do not install it into a DSH profile with `npm install`, `pnpm add`, or manual edits to the profile manifest or lockfile.

For upgrades, removal, local tarballs, profile inspection, and troubleshooting, see the [installation guide](docs/installation.md).

## What you get

| Capability | Status | What it does |
| --- | --- | --- |
| Question cards | Available | Compact single-select, multi-select, custom-answer, skip, previous-question, and submit flows. |
| Approval cards | Available | Allow once, reject, details, cancel, and keyboard-confirmation flows. |
| Standard profile | Available | Arrow keys, `Enter`, and `Escape` for question and approval interactions. |
| Vim profile | Available | `j`/`k`, `Enter`, and `Escape` for question and approval interactions. |
| Settings card | Available | Switch the active profile through the `dsh-ui-shortcuts` settings namespace. |
| Custom profile | Planned | Edit bindings, modifiers, alternatives, and two-stroke chords. |
| Global navigation | Planned | Move across sessions and Workspaces, create sessions, fork sessions, and switch theme. |
| Capability filtering | Planned | Show a global action only when the current DSH composition exposes its public action face. |

The current release contains the interaction takeover and the `standard`/`vim` profiles. Custom profiles and global navigation are documented here so their intended behavior is visible before implementation lands.

## Shortcut reference

### Available today

The plugin currently exposes four logical interaction commands across two surfaces:

| Command | Question | Approval |
| --- | --- | --- |
| Focus previous item | `ArrowUp` | `ArrowUp` |
| Focus next item | `ArrowDown` | `ArrowDown` |
| Activate current item | `Enter` | `Enter` |
| Cancel current task | `Escape` | `Escape` |

The Vim profile replaces the two focus bindings with `k` and `j`; confirmation and cancellation keep `Enter` and `Escape`.

These are four logical commands, eight question/approval bindings, and sixteen built-in profile rows across `standard` and `vim`. They are scoped to the active interaction card and do not become document-wide shortcuts.

### Planned global shortcuts

The following actions are planned for the global router. They are not shipped as working global shortcuts in the current release.

| Action | Proposed default | Current DSH capability | Roadmap state |
| --- | --- | --- | --- |
| Create a session | `Mod+N` | `workspaces.startSession()` | Public face available; plugin integration planned |
| Previous session | `Mod+Alt+ArrowUp` | `sessions.list` + `sessions.open()` | Public faces available; navigation adapter planned |
| Next session | `Mod+Alt+ArrowDown` | `sessions.list` + `sessions.open()` | Public faces available; navigation adapter planned |
| Previous Workspace | `Mod+Shift+ArrowLeft` | `workspaces.list` + `connectWorkspace()` + `sessions.open()` | Public faces available; navigation adapter planned |
| Next Workspace | `Mod+Shift+ArrowRight` | `workspaces.list` + `connectWorkspace()` + `sessions.open()` | Public faces available; navigation adapter planned |
| Fork current session | `Mod+Shift+B` | `sessions.fork()` + `sessions.open()` | Public faces available; integration planned |
| Toggle light/dark theme | `Mod+Shift+L` | `theme.getTheme()` + `theme.setTheme()` | Public face available; integration planned |
| Open settings panel | `Mod+,` | No public `openSettings()` face confirmed | Hidden until DSH exposes an opener |

That means **7 of the 8 planned global actions already have a current DSH public capability**. The plugin will not simulate the missing settings action through private DOM clicks or guessed routes.

### DSH actions worth reserving next

These are useful future candidates because the current DSH Web composition already exposes related public faces:

| Candidate | DSH face | Notes |
| --- | --- | --- |
| Toggle sidebar | `layout.toggleSidebar()` | Good fit for a global layout shortcut. |
| Open details | `layout.openDetails()` | Useful when reviewing a selected tool call. |
| Close details | `layout.closeDetails()` | Should remain safe when the panel is already closed. |
| Open a subagent | `sessions.openSubagent(address)` | Useful for agent-task navigation. |
| Submit the current draft | session `inputActions.submit()` | Must yield to text inputs, IME, and pending takeover cards. |
| Archive current session | `workspaces.archiveSession(sessionId)` | Destructive; requires confirmation and should not have a default binding. |

## Key design

The planned Custom profile follows conventions familiar from Claude Code and Codex without claiming to copy their complete default maps:

- `Mod` maps to `Meta` on macOS and `Ctrl` on other platforms.
- The UI displays `Cmd` or `Ctrl` according to the platform instead of storing two conflicting bindings.
- A binding accepts one key or a two-stroke chord such as `Ctrl+X Ctrl+S`.
- One command may have alternative bindings for platform compatibility or a user-selected backup key.
- Key aliases are normalized before comparison, including `Esc`/`Escape` and `Return`/`Enter`.
- A chord cannot have three or more strokes, and one binding cannot be a prefix of another binding in the same scope.

The planned global router yields to text inputs, textareas, contenteditable controls, IME composition, repeated key events, pending question/approval takeover, and host-owned popup focus. Every listener is owned by the current Client fiber and is removed when the plugin stops or updates.

## DSH compatibility

The plugin is an out-of-tree DSH Web Client extension. It uses public composition points rather than modifying DSH internals:

- `conversation.composer` for question and approval takeover;
- `settings.plugin.item` for the profile settings card;
- `dsh-ui-shortcuts` for Host settings persistence;
- `dsh-shortcuts` for Client locale dictionaries;
- fiber-owned effects for slot, settings, locale, and future keyboard registrations.

The package currently injects the session face needed by the interaction composer. Future global actions will consume the narrow public `sessions`, `workspaces`, `theme`, and `layout` faces and pass plain callbacks into components. DSH live services will not cross into React props or persisted settings.

## Roadmap

### Released

- Compact question and approval cards inside the DSH conversation composer.
- Standard and Vim profiles with one active profile at a time.
- Single-select, multi-select, custom-answer, skip, submit, and previous-question flows.
- Approval allow-once, reject, details, and cancellation flows.
- Localized English and Chinese settings copy.
- DSH semantic tokens, responsive layout, keyboard focus states, and local Iconify data.

### Current DSH integration

- Capability-aware global action adapter for the seven currently matchable actions.
- Session and Workspace navigation based on DSH list snapshots.
- Branch creation followed by opening the new child session.
- Light/dark theme switching through the public theme face.
- Sidebar, details panel, subagent, and draft-submit action reservations.

### Planned in this plugin

- Custom profile editing and persistence.
- `Mod`, explicit modifiers, alternative bindings, and two-stroke chords.
- Global shortcut routing with input and pending-interaction guards.
- Grouped shortcut legend for question, approval, and global scopes.
- Capability-gated visibility so unavailable actions disappear instead of becoming dead rows.

### Waiting for a DSH public face

- Open the settings panel directly.
- Open a session switcher or command palette.
- Switch transcript/trajectory views.
- Open model, permission-mode, Plan Mode, or background-job pickers.
- Expose queue steering, undo/redo, clipboard, and other InputBar-private operations to extension packages.

## Development

These commands develop this package. They are not profile installation commands:

```bash
pnpm install
pnpm run bundle
pnpm run typecheck
pnpm exec vitest run tests
```

`pnpm run bundle` emits the Node library, declarations, browser `lib/client.js`, and source map. The browser artifact keeps DSH platform modules external, rejects ordinary non-platform `@deepseek-ai/*` runtime imports, compiles CSS Modules with Lightning CSS, and inlines local Iconify data.

For the full DSH composition workflow, use the [installation guide](docs/installation.md). Browser verification must run through a real DSH Web profile with boot data; the `apps/web` Vite entry is not a standalone validation target.

## Package contract

| Item | Value |
| --- | --- |
| Package | `@hytime/dsh-client-ui-shortcuts` |
| Current version | `0.1.10` |
| Bundle row | `dsh-ui-shortcuts` |
| Settings namespace | `dsh-ui-shortcuts` |
| Persisted field | `activeProfile` |
| Locale namespace | `dsh-shortcuts` |
| Built-in profiles | `standard`, `vim` |
| Browser entry | `lib/client.js` |

## FAQ

### Does this change model behavior?

No. The plugin changes browser interaction only. It does not add tools, prompt sections, model-visible events, or model request context.

### Why does a global action not appear?

Global actions are capability-gated by design. If the current DSH composition does not expose the required public face, the action is not registered and its shortcut row is not rendered.

### Why did installing an update not change the open page?

DSH must reload the Web composition so the new Client bundle is loaded. Installing a package does not replace code already running in the browser.

### Can I use it without DSH Web?

No. The browser artifact is a DSH lazy-CJS loader factory and depends on DSH boot injection, slots, settings, locale, and runtime services.

## Links

- [Installation guide](docs/installation.md)
- [中文 README](README.zh.md)
- [Changelog](CHANGELOG.md)
- [中文变更日志](CHANGELOG.zh.md)
- [Global shortcuts and Custom profile plan](docs/superpowers/plans/2026-08-21-global-shortcuts-custom-profile-plan.md)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## License

MIT
