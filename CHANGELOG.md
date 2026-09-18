## 0.1.22 - DSH 0.1.6-alpha.2 support boundary and shortcut fixes

### Fixed

- A Custom profile no longer loses the default key of a command introduced after it was saved. The manager panel can only rebind a row, never add one, so a Custom profile saved before `0.1.20` had no `showShortcuts` binding and `Meta+Alt+Shift+S` silently stopped opening the panel. Profiles are now completed with the Standard default for every command and scope they do not define; a default that would collide with a binding the profile already carries is skipped. What a profile stores, exports, and fingerprints is unchanged — only the effective bindings behind the keyboard, the panel list, and the launch card gain the missing defaults, and the next save persists them.
- The Plugins-page shortcut card is visible again on DSH `0.1.6`. That release replaced the `settings.plugin.item` slot with `plugins.bundle.config`, which left the card without a seat and removed the plugin's settings entry.

### Compatibility

- The compatibility layer now mounts the shortcut card on whichever Plugins-page seat the running composition declares: `plugins.bundle.config` (DSH `0.1.6` and later, keyed by bundle package name) or the legacy `settings.plugin.item` (every earlier supported generation, keyed by settings namespace). Both seats are injected, so one source tree serves every generation without version detection; a composition declaring both mounts exactly one card, and a remounting owner re-runs the mount.
- Checked DSH `0.1.6-alpha.2` against the live Web composition: the `plugins.bundle.config` seat renders the card on the plugin's own page, `Meta+Alt+Shift+S` opens the manager panel, and the plugin logs no console error.
- Supported DSH now starts at `0.1.6-alpha.2`, the first release carrying `plugins.bundle.config`. `0.1.0-rc.8` through `0.1.1-rc.2`, `0.1.2-alpha.1`, and `0.1.5-*` are no longer supported; the compatibility layer's runtime probes stay, so those generations degrade to the plugin's older behaviour instead of crashing.
- The previously declared peer range never actually admitted the versions it claimed. A semver range only matches a prerelease whose `major.minor.patch` tuple it also names, so `>=0.1.2-alpha.1 <1.0.0` rejected `0.1.5-rc.2` and `0.1.6-alpha.2` alike. Every DSH range is now `>=0.1.6-alpha.2 <1.0.0`, which admits the current releases; the next DSH minor will need its prerelease tuple added in the same way.
- The type baseline moved with the range. `Context.slots` is declared by `ui-renderer` from `0.1.6` (not `ui-slots`, which is no longer a client row), and `Context.sessions` is no longer declared at all — the session service is read as `ctx.get('sessions')`, the pattern DSH's own client plugins use. A chain slot's inject now receives a plain `string` session id rather than the branded `SessionId`, so the parameter is widened to accept both generations.
- `settings.plugin.item` stays declared locally: `0.1.6`'s `ui-settings-plugins` stopped declaring it, and the compatibility layer still mounts there on a composition that offers it.

### Declarations

- `dsh.client.inject` and `peerDependencies` now also declare `@deepseek-ai/dsh-client-ui-plugin-manager` (owner of `plugins.bundle.config`) and `@deepseek-ai/dsh-client-ui-renderer` (owner of `Context.slots` from `0.1.6`), following the convention of injecting the owner of each consumed slot. Both are informational loader edges: an edge naming a package a composition does not carry is skipped, never fatal.
- `devDependencies` pin `@deepseek-ai/dsh-invariants` and `@deepseek-ai/dsh-settings` to `0.1.6-alpha.2` so the compiled and typechecked baseline matches the narrowed peer range.
- `pnpm-workspace.yaml` excludes the 21 pinned `@deepseek-ai/*@0.1.6-alpha.2` packages from pnpm's default 24-hour `minimumReleaseAge` window. A DSH release is always younger than that window when this plugin adopts it, and the version is already pinned in the lockfile with an integrity hash. Each entry names one exact version, so the list turns inert once those versions age and can then be deleted.

## 0.1.21 - Japanese and Korean languages, DSH 0.1.5-rc.2 support

### Added

- Japanese and Korean UI languages, selectable in DSH settings under Language. Every surface this plugin renders follows the active language, and a contributed language falls back to English for a key it does not carry.

### Compatibility

- Registering Japanese and Korean as selectable languages relies on the locale service's `addLanguage`, which first appears in `0.1.2-alpha.1`. On `0.1.0-rc.8` and `0.1.1-rc.2` the plugin detects the missing capability, skips that registration, and still loads with Chinese and English; the dictionaries themselves register on every version.
- Checked DSH `0.1.5-rc.2`: comparing every type declaration and the theme token set package by package found no breaking change to adapt to, and a real composition run verified the plugin (present in the boot graph, zero console errors, panel and settings entry behave, Japanese and Korean selectable). `0.1.5-alpha.2` and `0.1.5-rc.1` are intermediate releases checked statically only. The existing `>=0.1.2-alpha.1 <1.0.0` range already covers these versions.

### Declarations

- `dsh.client.inject` and `peerDependencies` now also declare `@deepseek-ai/dsh-client-ui-layout`: the plugin registers into the `shell.overlay` slot that package declares, matching the official convention of injecting the owner of each consumed slot (as `ui-conversation` injects `ui-layout`).

### Documentation

- The installation guides now link to each other's language.

## 0.1.20 - DSH 0.1.5-alpha.1 support and shortcut manager panel

### Compatibility

- Support DSH `0.1.5-alpha.1`: drop the dependency on the no-longer-published `@deepseek-ai/dsh-client-runtime` and consolidate the client types in a local `versioned-types.ts`, so a single source tree still covers the `0.1.0-rc.8` through `0.1.1-rc.2` and `0.1.2-alpha.1` lines.

### Added

- New `showShortcuts` global command (default `Meta+Alt+Shift+S`, editable in a Custom profile) that opens a full shortcut manager panel: profile switching, New / Import / Export / Delete, in-panel Custom binding editing, and one searchable unified shortcut list grouped by Question/Approval/Global with reasons when a global action is unavailable in the current DSH.
- A lightweight "open-panel shortcut" entry in the DSH plugin settings section: it shows the current summon key, opens the manager panel on click and locates that row; read-only profiles show a hint to switch to a Custom profile before editing, without auto-switching.

### Changed

- Profile management moved from the collapsible settings card into the panel opened by `Meta+Alt+Shift+S`; the old collapsible settings-card UI was removed.
- Panel geometry and elevation now follow the DSH component conventions: capsule buttons (radius 18, height 36), inputs (0.5px border, radius 8, layer-1 fill), modal mask and blur, dialog radius and shadow, and the group-label and row type scale.
- The editor action bar (Save / Cancel / Reset) moved out of the scrolling content and is pinned to the panel footer; the page behind the panel no longer scrolls while it is open.

### Fixed

- Fixed 15 theme tokens that do not exist in any supported DSH generation (`0.1.0-rc.8`, `0.1.1-rc.2`, `0.1.2-alpha.1`, `0.1.5-alpha.1`). Those variables resolved to the empty value, which silently dropped borders, made the primary button background transparent (it read as plain text), and disabled the error / success / warning state colors. A new style-token guard test now only allows tokens shared by every supported DSH generation.
- Raised the panel above the settings dialog and portal-mounted it to `document.body`, fixing the panel being covered when opened from the settings entry.
- Removed the dead style classes left behind by the settings-card migration.

## 0.1.19 - DSH Web compatibility fix

### Fixed

- Read the optional `remote.settings` namespace through the guarded service getter instead of traversing the proxied `remote` service.
- Keep the Client plugin loadable when the Remote provider is unavailable, while preserving legacy `connection.api.settings` fallback.

## 0.1.18 - GitHub release automation

### Changed

- Added a structured GitHub bug report form.
- Added `publish.yml` to test, build, and publish the package through npm Trusted Publishing when a matching GitHub Release is published.

## 0.1.17 - DSH Web compatibility

### Fixed

- Adapted interaction rendering and responses to the current DSH Web question, plan-review, and approval carriers while retaining legacy compatibility.
- Switched settings persistence to the current remote settings mutation API.
- Added a capability-probing compatibility adapter for DSH `0.1.0-rc.8` through `0.1.1-rc.2` and `0.1.2-alpha.1` or later, covering settings mutation, new-session actions, and pending-interaction guards.

## 0.1.16 - Reset Custom profile to defaults

### Added

- Added a Reset to defaults action for the active Custom profile.
- Reset preserves the profile name and ID while replacing only its bindings.
- Reset keeps the original profile and draft intact when persistence fails, and remains unavailable for read-only Standard and Vim profiles.

## 0.1.15 - First-use onboarding

### Added

- Added a dismissible first-use guide inside the shortcut settings card.
- Added direct entry points for creating a Custom profile and importing a JSON profile.
- Stored only a versioned browser-local completion marker; shortcut settings and profile JSON remain unchanged.

## 0.1.14 - Named custom profiles and JSON portability

### Added

- Added multiple named Custom profiles with New, Import, Export, and confirmed Delete controls; Standard and Vim remain read-only.
- Added a strict, single-profile JSON v1 format with a 1 MiB import limit. Files omit internal IDs, every import allocates a new ID, and duplicate names receive continuing numeric suffixes.

### Changed

- Export now writes only the active Custom profile's authoritative saved snapshot, excluding unsaved editor changes and all other profiles.

## 0.1.13 - Git source installation and package metadata

### Fixed

- Added a `prepare` lifecycle script that reuses the standalone `bundle` build so pinned GitHub source installs generate every published `lib/` entry point.
- Added canonical repository, homepage, and issue tracker metadata so npm consumers and plugin catalogs can map the package to its GitHub source.

### Changed

- Documented prebuilt npm installation as the recommended path and pinned GitHub source installation with pnpm `allowBuilds` requirements.

## 0.1.12 - Physical modifiers and reliable global navigation

### Added

- Added platform-aware SVG keycaps for Command, Windows/Meta, Control, Option/Alt, Shift, navigation keys, and ordinary characters.
- Added browser-safe global shortcuts that work from editable controls and navigate existing Sessions and Workspaces without creating blank replacements.
- Added automatic expansion of a collapsed target Workspace before its selected Session is opened.

### Fixed

- Kept the `Custom` profile selected after saving and preserved the settings controller context while persisting custom bindings.
- Rendered question option descriptions and preserved long-text wrapping in interaction cards.
- Normalized layout-dependent keyboard input from physical event codes, including macOS Option/Shift combinations.
- Filtered blank, archived, and subagent Sessions from navigation and rejected known browser-reserved or conflicting bindings.

### Changed

- Removed the public `Mod` modifier. Settings and canonical bindings now use the physical `Meta`, `Ctrl`, `Alt`, and `Shift` modifiers; legacy persisted `Mod` input migrates to `Meta` and is never written back.
- Made shortcut conflict identity platform-independent while keeping platform differences limited to keycap presentation.

## 0.1.11 - Global shortcuts and Custom profile

### Added

- Added the editable `Custom` profile with persisted bindings, explicit `Meta`, `Ctrl`, `Alt`, and `Shift` modifiers, alternatives, and bounded two-stroke chords. Legacy persisted `Mod` values are accepted only as compatibility input and migrated to `Meta`; they are never written back.
- Added capability-aware global actions for session and Workspace navigation, session creation and forking, and theme switching.
- Added a fiber-owned global keyboard router with guards for editable controls, IME composition, repeated events, pending question/approval takeover, and host popups.
- Added grouped global shortcut rows that hide actions unavailable in the current DSH composition.

### Fixed

- Focus pending question and approval controls when entering a session with an active interaction; this release intentionally prioritizes immediate keyboard operation over preserving an external editor or popup focus.
- Preserve custom question input and no-option textarea focus across controlled text updates.

### Changed

- Kept the settings opener binding hidden and inactive because DSH does not expose a public settings opener; no private DOM route is used.
- Documented DSH CLI installation and real-composition verification as the supported integration path.

## Previous releases

### Fixed

- Pressing Enter on an already selected single-choice option now submits the current answer.


### Fixed

- Added a previous-question action that preserves earlier answers in multi-question flows.
- Fixed primary submit text contrast while keyboard focus is active by using DSH foreground tokens.


### Fixed

- Restored DSH button resets so question options no longer render as oversized native gray controls.
- Added visible keyboard focus/hover states and check icons for multi-select options.
- Separated approval status title from approval details and tightened its action spacing.


### Changed

- Reduced question option and input heights, added consistent option gaps, and kept the primary submit action visible for single-select questions.
- Clarified the settings profile hierarchy with separate section and current-profile labels.


### Fixed

- Localized approval action labels and accessibility labels through the client dictionaries.
- Styled question skip/next/submit buttons with DSH action spacing and focus states.

### Changed

- Added command icons to question and approval shortcut rows.
- Replaced profile radio controls with a compact native select.
- Removed remaining hardcoded labels from the legacy profile card.


### Changed

- Documented DSH CLI as the only profile installation and upgrade path.
- Added npm keywords for DSH plugin discovery, including `dsh-plugin`.


### Fixed

- Fixed question and approval interaction cards to stay in the DSH conversation composer with bounded scrolling and visible action rows.
- Fixed question skip labels and skip submission for click and keyboard activation.
- Added semantic approval warning styling and responsive card geometry.

### Changed

- Restyled question and approval shortcut summaries as grouped DSH-style lists.


### Fixed

- Fixed the shortcuts composer priority ordering so it is tried before the official DSH question and approval composers.
- Added a slot-wiring regression for the lower-first DSH chain election order.

## 0.1.2 - Composer priority metadata

### Fixed

- Added explicit composer priority metadata and a slot-wiring regression while aligning the takeover with DSH chain routing.

## 0.1.1 - UI interaction fixes

### Fixed

- Fixed question option controls rendering with DSH token-based card styling instead of unstyled native controls.
- Fixed initial question focus and roving `tabIndex` navigation for Arrow/Enter keyboard selection.
- Added a collapsible settings card matching the DSH plugin-card disclosure pattern.
- Preserved session-scoped cancellation while refreshing the active conversation lookup at cancel time.

## 0.1.0 - Initial release

### Added

- Added the independent DSH Client UI shortcuts plugin for Web question and approval interactions.
- Added the `standard` and `vim` profiles with one active profile at a time.
- Added Arrow-key, `j`/`k`, Enter, and Escape handling for question and approval surfaces.
- Added single-select, multi-select, custom-answer, skip, submit, allow-once, reject, and session-scoped cancel flows.
- Added the `dsh-ui-shortcuts` Host settings namespace with the persisted `activeProfile` field.
- Added the `dsh-shortcuts` locale namespace and a profile settings card.
- Added CSS Modules, semantic DSH design tokens, local offline Iconify icons, and responsive reduced-motion styling.

### Package and integration

- Added the DSH bundle patch with row id `dsh-ui-shortcuts`.
- Added the lazy-CJS browser artifact at `lib/client.js` and the Node/invariant artifacts.
- Added package purity checks that reject non-platform DSH runtime imports from the browser bundle.
- Added profile, composer, slot lifecycle, settings, bundle, tarball, and DSH composition verification.
- Added bilingual package and installation documentation.
