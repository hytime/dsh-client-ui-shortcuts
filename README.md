# DSH Client UI Shortcuts

[![npm version](https://img.shields.io/npm/v/%40hytime%2Fdsh-client-ui-shortcuts?logo=npm&label=npm)](https://www.npmjs.com/package/@hytime/dsh-client-ui-shortcuts) [![license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit/)

English | [中文](README.zh.md)

Browser-safe, profile-aware keyboard control for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web.

This plugin runs inside DSH Web, adds predictable keyboard control for question and approval flows, and provides Session and Workspace navigation when the corresponding DSH capabilities are available. It does not modify DSH core, the agent loop, or the model protocol.

## Why install it

- Answer DSH questions and approvals without leaving the keyboard.
- Choose Standard, Vim, or Custom profiles for interaction cards and global actions.
- Navigate Sessions and Workspaces with explicit physical `Meta`, `Ctrl`, `Alt`, and `Shift` modifiers.
- Automatically expand a collapsed target Workspace before opening an existing eligible Session.
- Keep unavailable actions out of routing and shortcut lists when DSH does not provide the required capability.
- Stay within browser and operating-system boundaries: reserved shortcuts may never reach a web page.

## Screenshots

Question and approval interaction shortcuts:

![Question and approval shortcut settings](https://raw.githubusercontent.com/hytime/dsh-client-ui-shortcuts/main/docs/ScreenShot_2026-08-24_011032_061.png)

Global Session and Workspace shortcuts with platform keycaps:

![Global Session and Workspace shortcut settings](https://raw.githubusercontent.com/hytime/dsh-client-ui-shortcuts/main/docs/ScreenShot_2026-08-24_011111_040.png)

## Install in 60 seconds

Install the plugin through the DSH CLI, then restart or reload the Web composition:

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.12
dsh --profile web
```

The plugin is not a standalone React or Vite application. Do not open `apps/web` directly and do not install it into a DSH profile with `npm install`, `pnpm add`, or manual edits to the profile manifest or lockfile.

For upgrades, removal, local tarballs, profile inspection, and troubleshooting, see the [installation guide](docs/installation.md).

## What is included

- Question cards with single-select, multi-select, custom-answer, skip, previous-question, and submit flows.
- Approval cards with allow once, reject, details, cancel, and keyboard-confirmation flows.
- Standard, Vim, and editable Custom profiles with one active profile at a time.
- Explicit physical `Meta`, `Ctrl`, `Alt`, and `Shift` modifiers, alternatives, and two-stroke chords.
- Browser-reserved shortcut denylist and conflict validation.
- Capability checks for DSH features that are not available in the current composition.
- Session, Workspace, session-branch, and theme actions when the corresponding DSH capabilities are available.

## Shortcut reference

### Question and approval cards

| Command | Question | Approval |
| --- | --- | --- |
| Focus previous item | `ArrowUp` | `ArrowUp` |
| Focus next item | `ArrowDown` | `ArrowDown` |
| Activate current item | `Enter` | `Enter` |
| Cancel current task | `Escape` | `Escape` |

The Vim profile replaces the two focus bindings with `k` and `j`; confirmation and cancellation keep `Enter` and `Escape`. These bindings are scoped to the active interaction card.

### Global actions

The active profile's default global bindings are:

| Action | Default binding |
| --- | --- |
| Create a Session | `Meta+Alt+Shift+N` |
| Previous Session | `Meta+Alt+Shift+J` |
| Next Session | `Meta+Alt+Shift+K` |
| Previous Workspace | `Meta+Alt+Shift+H` |
| Next Workspace | `Meta+Alt+Shift+L` |
| Fork current Session | `Meta+Alt+Shift+B` |
| Toggle light/dark theme | `Meta+Alt+Shift+T` |

Global actions are registered only when DSH provides the required capability.

## Profiles and Custom bindings

`Standard` uses arrow keys, `Enter`, and `Escape` for question and approval interactions. `Vim` uses `j`/`k`, `Enter`, and `Escape`. `Custom` lets you edit question, approval, and capability-backed global bindings, including explicit modifiers, alternatives, and two-stroke chords.

The resolver matches physical `KeyboardEvent.code` values, normalizes aliases such as `Esc`/`Escape` and `Return`/`Enter`, rejects prefix conflicts, and limits chords to two strokes. On macOS, `Meta` is displayed as Command and `Alt` as Option; on other platforms, `Meta` is displayed as Windows key and `Ctrl` as Control.

## Browser and platform boundaries

The router uses capture-phase listeners in the browser. It yields to unmatched text input, IME composition, repeated events, pending question or approval takeover, and host-owned popup focus. A matching global action can run from an input or contenteditable element because it is an explicit global binding.

The browser denylist covers known Chrome, Safari, Firefox, and Edge combinations. It cannot query arbitrary OS or browser shortcut ownership, and capture listeners can prevent only shortcuts the browser has dispatched to the page.

## Workspace and Session navigation

Session navigation follows the current Workspace's stored Session order and skips archived, subagent, and blank Sessions. Workspace navigation opens an existing non-blank Session in the target Workspace. When a target Workspace is collapsed, the plugin expands it automatically before opening the eligible Session; navigation does not create a blank Session or call `connectWorkspace` to manufacture a target.

## DSH compatibility

The package is loaded only through a real DSH Web composition and DSH boot/module loader. Installing an update does not replace code already running in an open page; reload the Web composition to load the new Client bundle.

## Development and verification

These commands develop this package. They are not profile installation commands:

```bash
pnpm install
pnpm run bundle
pnpm run typecheck
pnpm exec vitest run tests
```

For the full DSH composition workflow, use the [installation guide](docs/installation.md). Browser verification must run through a real DSH Web profile with boot data; the `apps/web` Vite entry is not a standalone validation target.

## FAQ

### Does this change model behavior?

No. The plugin changes browser interaction only. It does not add tools, prompt sections, model-visible events, or model request context.

### Why does a global action not appear?

Global actions are available only when the current DSH composition provides the required capability. Actions that are unavailable are not registered, and their shortcut rows are not shown.

### Why is the settings shortcut hidden?

DSH does not provide a public settings opener, so the retained `Meta+,` binding stays hidden and is not activated.

### Why did installing an update not change the open page?

DSH must reload the Web composition so the new Client bundle is loaded. Installing a package does not replace code already running in the browser.

### Can I use it without DSH Web?

No. The browser artifact is a DSH loader factory and depends on DSH boot injection, slots, settings, locale, and runtime services.

## Links

- [Installation guide](docs/installation.md)
- [中文 README](README.zh.md)
- [Changelog](CHANGELOG.md)
- [中文变更日志](CHANGELOG.zh.md)
- [DeepSeek Harness extension documentation](https://github.com/deepseek-ai/deepseek-harness/tree/main/docs)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

## License

MIT
