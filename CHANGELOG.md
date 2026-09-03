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
