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
| Custom profile | Available | Edit question, approval, and capability-backed global bindings, including modifiers, alternatives, and two-stroke chords. |
| Global actions | Available | Route capability-aware session, Workspace, session-branch, and theme actions through the DSH public faces. |
| Capability filtering | Available | Register and render each global action only when the current DSH composition exposes its required public action face. |

The current release contains interaction takeover, the `standard`/`vim` profiles, the editable `Custom` profile, and the capability-aware global router. The settings opener remains hidden because DSH does not expose a public opener; the plugin does not simulate it through private DOM clicks or guessed routes.

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

### Global shortcuts

The global router is available in the active profile. Its built-in global bindings are:

| Action | Default binding | Capability requirement |
| --- | --- | --- |
| Create a session | `Mod+N` | `workspaces.startSession()` |
| Previous session | `Mod+Alt+ArrowUp` | session list and `sessions.open()` |
| Next session | `Mod+Alt+ArrowDown` | session list and `sessions.open()` |
| Previous Workspace | `Mod+Shift+ArrowLeft` | Workspace list, `connectWorkspace()`, and `sessions.open()` |
| Next Workspace | `Mod+Shift+ArrowRight` | Workspace list, `connectWorkspace()`, and `sessions.open()` |
| Fork current session | `Mod+Shift+B` | `sessions.fork()` and `sessions.open()` |
| Toggle light/dark theme | `Mod+Shift+L` | `theme.getTheme()` and `theme.setTheme()` |

The `Mod+,` settings binding is retained in the profile data but remains hidden and inactive because no public DSH settings opener is available. Capability filtering removes unavailable global actions from both routing and the shortcut list; it does not leave dead rows or simulate private DSH UI behavior.

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

The Custom profile follows conventions familiar from Claude Code and Codex without claiming to copy their complete default maps:

- `Mod` maps to `Meta` on macOS and `Ctrl` on other platforms.
- The UI displays `Cmd` or `Ctrl` according to the platform instead of storing two conflicting bindings.
- A binding accepts one key or a two-stroke chord such as `Ctrl+X Ctrl+S`.
- One command may have alternative bindings for platform compatibility or a user-selected backup key.
- Key aliases are normalized before comparison, including `Esc`/`Escape` and `Return`/`Enter`.
- A chord cannot have three or more strokes, and one binding cannot be a prefix of another binding in the same scope.

The global router yields to text inputs, textareas, contenteditable controls, IME composition, repeated key events, pending question/approval takeover, and host-owned popup focus. Every listener is owned by the current Client fiber and is removed when the plugin stops or updates.

## DSH compatibility

The plugin is an out-of-tree DSH Web Client extension. It uses public composition points rather than modifying DSH internals:

- `conversation.composer` for question and approval takeover;
- `settings.plugin.item` for the profile settings card;
- `dsh-ui-shortcuts` for Host settings persistence;
- `dsh-shortcuts` for Client locale dictionaries;
- fiber-owned effects for slot, settings, locale, and future keyboard registrations.

The plugin injects the session, Workspace, and theme faces needed by the active global actions. It extracts only plain action callbacks before passing data to React; DSH live services do not cross into React props or persisted settings.

## Roadmap

### Current integration

- Compact question and approval cards inside the DSH conversation composer.
- Standard, Vim, and editable Custom profiles with one active profile at a time.
- Custom binding persistence with `Mod`, explicit modifiers, alternatives, and two-stroke chords.
- Capability-aware global action adapter and fiber-owned keyboard router.
- Session and Workspace navigation based on DSH list snapshots.
- Branch creation followed by opening the new child session.
- Light/dark theme switching through the public theme face.
- Grouped question, approval, and global shortcut legend with unavailable actions hidden.
- Input, IME, repeat, pending-interaction, and host-popup guards for global routing.

### Waiting for a DSH public face

- Open the settings panel directly; the existing settings binding stays hidden.
- Open a session switcher or command palette when DSH exposes a public opener.
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
| Persisted fields | `activeProfile`, `customBindings` |
| Locale namespace | `dsh-shortcuts` |
| Built-in profiles | `standard`, `vim` |
| Editable profile | `custom` |
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
- [DeepSeek Harness extension documentation](https://github.com/deepseek-ai/deepseek-harness/tree/main/docs)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## License

MIT
